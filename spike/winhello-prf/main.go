//go:build windows

// Spike probe for issue #92: validate that the native Windows WebAuthn API (via
// go-ctap/winhello, CGO-free) can derive a stable PRF/hmac-secret secret from a
// passkey and use it to envelope-encrypt the app's master key.
//
// It tests the TWO authenticator paths the app offers, each with the residency
// Windows actually requires:
//
//	winhello-prf.exe          # Windows Hello: platform authenticator, RESIDENT
//	                          #   webauthn.dll requires resident creds for
//	                          #   hmac-secret on Hello (libfido2 #731)
//	winhello-prf.exe key      # Security key (YubiKey): cross-platform, NON-resident
//	winhello-prf.exe cleanup  # delete the spike's resident credential(s) + state
//
// PRF is EVALUATED at create() (pPRFGlobalEval). The generic CTAP guidance is to
// enable-only and derive at get(), but Windows Hello / NGC rejects the
// enable-only path with NTE_NOT_SUPPORTED (0x80090029) and falls back to the
// device chooser — observed in the Microsoft-Windows-WebAuthN/Operational ETW log.
// The credential id + salt still re-derive the same secret at get() afterwards.
//
// Build (from WSL/Linux, no CGO):
//
//	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o winhello-prf.exe .
package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/go-ctap/ctaphid/pkg/webauthntypes"
	"github.com/go-ctap/winhello"
	"github.com/go-ctap/winhello/hiddenwindow"
	"github.com/ldclabs/cose/iana"
	"golang.org/x/sys/windows"
)

const (
	rpID   = "paddockcontrol.local"
	rpName = "PaddockControl"
)

// prfSalt is the fixed PRF input the app would use to derive the wrapping key.
var prfSalt = []byte("paddockcontrol/master-key-wrap/v1")

// path is one authenticator configuration under test. The residency is the key
// variable: Windows Hello needs resident/discoverable credentials for hmac-secret,
// while a roaming security key uses non-resident so it consumes no on-key slot.
type path struct {
	name       string
	attachment winhello.WinHelloAuthenticatorAttachment
	resident   bool
	hint       webauthntypes.PublicKeyCredentialHint
	stateFile  string
}

var (
	helloPath = path{
		name:       "Windows Hello (platform, resident)",
		attachment: winhello.WinHelloAuthenticatorAttachmentPlatform,
		resident:   true,
		hint:       webauthntypes.PublicKeyCredentialHintClientDevice,
		stateFile:  "winhello-prf.credid.platform",
	}
	keyPath = path{
		name:       "security key (cross-platform, non-resident)",
		attachment: winhello.WinHelloAuthenticatorAttachmentCrossPlatform,
		resident:   false,
		hint:       webauthntypes.PublicKeyCredentialHintSecurityKey,
		stateFile:  "winhello-prf.credid.key",
	}
)

func main() {
	p := helloPath
	cleanup := false
	for _, a := range os.Args[1:] {
		switch a {
		case "key":
			p = keyPath
		case "cleanup":
			cleanup = true
		default:
			fail("unknown argument %q (use: [key] [cleanup])", a)
		}
	}

	fmt.Printf("[INFO] path: %s | hint=%s\n", p.name, p.hint)
	fmt.Println("[INFO] PRF strategy: evaluate at create (pPRFGlobalEval) — required by Windows Hello/NGC")
	fmt.Println("[INFO] >>> WATCH the Windows dialog: a 'phone / security key' chooser, or straight to the authenticator? <<<")

	wnd, err := hiddenwindow.New(slog.New(slog.DiscardHandler), "PaddockControl PRF Spike")
	if err != nil {
		fail("create hidden window: %v", err)
	}
	defer wnd.Close()
	hWnd := wnd.WindowHandle()

	fmt.Printf("[INFO] Windows WebAuthn API version: %d\n", winhello.APIVersionNumber())
	avail, err := winhello.IsUserVerifyingPlatformAuthenticatorAvailable()
	fmt.Printf("[INFO] Windows Hello platform authenticator available: %v (err=%v)\n", avail, err)

	if cleanup {
		doCleanup()
		return
	}

	credID, fresh := ensureCredential(hWnd, p)
	fmt.Printf("[INFO] credential id (%d bytes): %s\n", len(credID), base64.URLEncoding.EncodeToString(credID))
	if fresh {
		fmt.Println("[INFO] created a NEW credential — run again to prove cross-restart re-derivation")
	} else {
		fmt.Println("[PASS] reused an existing credential from a previous process (cross-restart path)")
	}

	// PRF must be deterministic for a fixed (credential, salt): a stable KEK. Two
	// independent assertions must yield the same 32 bytes.
	secretA := derivePRF(hWnd, p, credID, prfSalt)
	secretB := derivePRF(hWnd, p, credID, prfSalt)
	fmt.Printf("[INFO] PRF secret (32B expected, got %d): %s\n", len(secretA), hex.EncodeToString(secretA))
	if len(secretA) != 32 {
		fail("PRF output is %d bytes, expected 32", len(secretA))
	}
	if !bytes.Equal(secretA, secretB) {
		fail("PRF secret is NOT deterministic — cannot be a stable wrapping key")
	}
	fmt.Println("[PASS] PRF secret is deterministic for a fixed (credential, salt)")

	// Envelope round-trip: wrap a dummy master key with the PRF KEK, then unwrap
	// with the independently re-derived secret.
	masterKey := make([]byte, 32)
	_, _ = rand.Read(masterKey)
	wrapped, err := aesGCMSeal(secretA, masterKey)
	if err != nil {
		fail("wrap master key: %v", err)
	}
	unwrapped, err := aesGCMOpen(secretB, wrapped)
	if err != nil {
		fail("unwrap master key: %v", err)
	}
	if !bytes.Equal(masterKey, unwrapped) {
		fail("unwrapped master key does not match the original")
	}
	fmt.Println("[PASS] envelope round-trip: master key wrapped with the PRF KEK and recovered")

	fmt.Printf("\n=== RESULT: %s PRF envelope works on this machine. ===\n", p.name)
	fmt.Println("Run `winhello-prf.exe cleanup` to remove the spike credential(s).")
}

// ensureCredential returns a persisted credential id, or creates a fresh one. The
// credential enables hmac-secret/PRF at creation but does not evaluate it.
func ensureCredential(hWnd windows.HWND, p path) (credID []byte, fresh bool) {
	if data, err := os.ReadFile(statePath(p.stateFile)); err == nil {
		if id, derr := base64.URLEncoding.DecodeString(string(bytes.TrimSpace(data))); derr == nil && len(id) > 0 {
			return id, false
		}
	}

	resp, err := winhello.MakeCredential(
		hWnd,
		[]byte("{}"),
		webauthntypes.PublicKeyCredentialRpEntity{ID: rpID, Name: rpName},
		webauthntypes.PublicKeyCredentialUserEntity{ID: []byte("paddock-user"), Name: "paddock", DisplayName: rpName},
		[]webauthntypes.PublicKeyCredentialParameters{
			{Type: webauthntypes.PublicKeyCredentialTypePublicKey, Algorithm: iana.AlgorithmES256},
		},
		nil,
		// Evaluate PRF at creation (pPRFGlobalEval). Windows Hello / NGC REQUIRES
		// this: bEnablePrf-only (CreateHMACSecret) makes NGC MakeCredential return
		// NTE_NOT_SUPPORTED (0x80090029) and fall back to the device chooser —
		// confirmed in the Microsoft-Windows-WebAuthN/Operational ETW log. (winhello
		// v0.1.0 also dereferences PRF.Eval unconditionally on this path.)
		&webauthntypes.CreateAuthenticationExtensionsClientInputs{
			PRFInputs: &webauthntypes.PRFInputs{PRF: webauthntypes.AuthenticationExtensionsPRFInputs{
				Eval: &webauthntypes.AuthenticationExtensionsPRFValues{First: prfSalt},
			}},
		},
		&winhello.AuthenticatorMakeCredentialOptions{
			AuthenticatorAttachment:     p.attachment,
			UserVerificationRequirement: winhello.WinHelloUserVerificationRequirementRequired,
			RequireResidentKey:          p.resident,
			CredentialHints:             []webauthntypes.PublicKeyCredentialHint{p.hint},
		},
	)
	if err != nil {
		fail("MakeCredential: %v", err)
	}
	fmt.Printf("[INFO] MakeCredential OK; PRFEnabled=%v usedTransport=%v residentKey=%v\n",
		resp.PRFEnabled, resp.UsedTransport, resp.ResidentKey)
	if !resp.PRFEnabled {
		fmt.Println("[WARN] PRFEnabled=false on create — the get() below is the real test of PRF support")
	}
	if err := os.WriteFile(statePath(p.stateFile), []byte(base64.URLEncoding.EncodeToString(resp.CredentialID)), 0o600); err != nil {
		fmt.Printf("[WARN] could not persist credential id: %v\n", err)
	}
	return resp.CredentialID, true
}

// derivePRF evaluates the PRF for (credID, salt) via a get() assertion, routed to
// the credential's authenticator class so Windows skips the device chooser.
func derivePRF(hWnd windows.HWND, p path, credID, salt []byte) []byte {
	descriptor := webauthntypes.PublicKeyCredentialDescriptor{
		ID:   credID,
		Type: webauthntypes.PublicKeyCredentialTypePublicKey,
	}
	if p.attachment == winhello.WinHelloAuthenticatorAttachmentPlatform {
		descriptor.Transports = []webauthntypes.AuthenticatorTransport{
			webauthntypes.AuthenticatorTransportInternal,
		}
	}

	assertion, err := winhello.GetAssertion(
		hWnd,
		rpID,
		[]byte("{}"),
		[]webauthntypes.PublicKeyCredentialDescriptor{descriptor},
		&webauthntypes.GetAuthenticationExtensionsClientInputs{
			PRFInputs: &webauthntypes.PRFInputs{PRF: webauthntypes.AuthenticationExtensionsPRFInputs{
				EvalByCredential: map[string]webauthntypes.AuthenticationExtensionsPRFValues{
					base64.URLEncoding.EncodeToString(credID): {First: salt},
				},
			}},
		},
		&winhello.AuthenticatorGetAssertionOptions{
			AuthenticatorAttachment:     p.attachment,
			UserVerificationRequirement: winhello.WinHelloUserVerificationRequirementRequired,
		},
	)
	if err != nil {
		fail("GetAssertion: %v", err)
	}
	if !assertion.ExtensionOutputs.PRFOutputs.PRF.Enabled {
		fail("assertion did not return a PRF result (prf.enabled=false)")
	}
	return assertion.ExtensionOutputs.PRFOutputs.PRF.Results.First
}

// doCleanup deletes the resident Windows Hello credentials this spike created
// (found by rpID, robust even if the state files are gone) and the state files.
func doCleanup() {
	creds, err := winhello.PlatformCredentialList(rpID, false)
	if err != nil {
		fmt.Printf("[WARN] PlatformCredentialList: %v\n", err)
	}
	removed := 0
	for _, c := range creds {
		if c.RP.ID != rpID {
			continue
		}
		if derr := winhello.DeletePlatformCredential(c.CredentialID); derr != nil {
			fmt.Printf("[WARN] delete %x: %v\n", c.CredentialID, derr)
			continue
		}
		removed++
	}
	fmt.Printf("[INFO] removed %d Windows Hello credential(s) for %q\n", removed, rpID)

	_ = os.Remove(statePath(helloPath.stateFile))
	_ = os.Remove(statePath(keyPath.stateFile))
	fmt.Println("[NOTE] a credential created on a SECURITY KEY (YubiKey) lives on the key itself and")
	fmt.Println("       cannot be removed from here — use Yubico Authenticator or: ykman fido credentials delete")
	fmt.Println("[INFO] cleanup done")
}

func aesGCMSeal(key, plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

func aesGCMOpen(key, ct []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	ns := gcm.NonceSize()
	if len(ct) < ns {
		return nil, fmt.Errorf("ciphertext too short")
	}
	return gcm.Open(nil, ct[:ns], ct[ns:], nil)
}

func statePath(name string) string {
	exe, err := os.Executable()
	if err != nil {
		return name
	}
	return filepath.Join(filepath.Dir(exe), name)
}

func fail(format string, a ...any) {
	fmt.Printf("[FAIL] "+format+"\n", a...)
	os.Exit(1)
}

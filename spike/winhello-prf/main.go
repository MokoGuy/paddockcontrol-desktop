//go:build windows

// Spike probe for issue #92: validate that the native Windows WebAuthn API
// (via go-ctap/winhello, CGO-free) can derive a stable PRF/hmac-secret secret
// from Windows Hello (platform authenticator) and use it to envelope-encrypt
// the app's master key.
//
// Run on Windows (it shows the Windows Hello UI):
//
//	winhello-prf.exe            # first run: create a Hello credential + test
//	winhello-prf.exe            # run again: re-derive from a fresh process (cross-restart)
//	winhello-prf.exe cleanup    # delete the spike credential + state file
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
	rpID      = "paddockcontrol.local"
	rpName    = "PaddockControl"
	stateFile = "winhello-prf.credid" // base64url credential id, persisted between runs
)

// prfSalt is the fixed PRF input the app would use to derive the wrapping key.
var prfSalt = []byte("paddockcontrol/master-key-wrap/v1")

func main() {
	cleanup := len(os.Args) > 1 && os.Args[1] == "cleanup"

	wnd, err := hiddenwindow.New(slog.New(slog.DiscardHandler), "PaddockControl PRF Spike")
	if err != nil {
		fail("create hidden window: %v", err)
	}
	defer wnd.Close()
	hWnd := wnd.WindowHandle()

	fmt.Printf("[INFO] Windows WebAuthn API version: %d\n", winhello.APIVersionNumber())
	avail, err := winhello.IsUserVerifyingPlatformAuthenticatorAvailable()
	fmt.Printf("[INFO] Windows Hello platform authenticator available: %v (err=%v)\n", avail, err)
	if !avail {
		fail("Windows Hello (platform authenticator) is not available/set up on this machine")
	}

	if cleanup {
		doCleanup(hWnd)
		return
	}

	credID, fresh := ensureCredential(hWnd)
	fmt.Printf("[INFO] credential id (%d bytes): %s\n", len(credID), base64.URLEncoding.EncodeToString(credID))
	if fresh {
		fmt.Println("[INFO] created a NEW Hello credential — run the probe again to prove cross-restart re-derivation")
	} else {
		fmt.Println("[PASS] reused an existing credential from a previous process (cross-restart path)")
	}

	// Derive the PRF secret twice with the SAME salt -> must be identical (a stable KEK).
	secretA := derivePRF(hWnd, credID, prfSalt)
	secretB := derivePRF(hWnd, credID, prfSalt)
	fmt.Printf("[INFO] PRF secret (32B expected, got %d): %s\n", len(secretA), hex.EncodeToString(secretA))
	if len(secretA) != 32 {
		fail("PRF output is %d bytes, expected 32", len(secretA))
	}
	if !bytes.Equal(secretA, secretB) {
		fail("PRF secret is NOT deterministic across two evaluations — cannot be used as a stable wrapping key")
	}
	fmt.Println("[PASS] PRF secret is deterministic for a fixed (credential, salt)")

	// A different salt must give a different secret.
	secretOther := derivePRF(hWnd, credID, []byte("paddockcontrol/other-context"))
	if bytes.Equal(secretA, secretOther) {
		fail("different salt produced the same secret — PRF not salt-dependent")
	}
	fmt.Println("[PASS] different salt -> different secret (salt-dependent)")

	// Full envelope demo: wrap a dummy 32-byte master key with the PRF-derived KEK,
	// then re-derive and unwrap.
	masterKey := make([]byte, 32)
	_, _ = rand.Read(masterKey)
	wrapped, err := aesGCMSeal(secretA, masterKey)
	if err != nil {
		fail("wrap master key: %v", err)
	}
	kek := derivePRF(hWnd, credID, prfSalt) // re-derive (simulating a later unlock)
	unwrapped, err := aesGCMOpen(kek, wrapped)
	if err != nil {
		fail("unwrap master key: %v", err)
	}
	if !bytes.Equal(masterKey, unwrapped) {
		fail("unwrapped master key does not match the original")
	}
	fmt.Println("[PASS] envelope round-trip: master key wrapped with the PRF KEK and recovered")

	fmt.Println("\n=== RESULT: Windows Hello PRF envelope works on this machine. ===")
	fmt.Println("Run `winhello-prf.exe cleanup` to remove the spike credential.")
}

func ensureCredential(hWnd windows.HWND) (credID []byte, fresh bool) {
	if data, err := os.ReadFile(statePath()); err == nil {
		if id, derr := base64.URLEncoding.DecodeString(string(bytes.TrimSpace(data))); derr == nil && len(id) > 0 {
			return id, false
		}
	}

	resp, err := winhello.MakeCredential(
		hWnd,
		[]byte("{}"),
		webauthntypes.PublicKeyCredentialRpEntity{ID: rpID, Name: rpName},
		webauthntypes.PublicKeyCredentialUserEntity{ID: []byte("paddock-user"), Name: "paddock", DisplayName: "PaddockControl"},
		[]webauthntypes.PublicKeyCredentialParameters{
			{Type: webauthntypes.PublicKeyCredentialTypePublicKey, Algorithm: iana.AlgorithmES256},
		},
		nil,
		// Enable the PRF extension on this credential.
		&webauthntypes.CreateAuthenticationExtensionsClientInputs{
			PRFInputs: &webauthntypes.PRFInputs{PRF: webauthntypes.AuthenticationExtensionsPRFInputs{}},
		},
		&winhello.AuthenticatorMakeCredentialOptions{
			AuthenticatorAttachment:     winhello.WinHelloAuthenticatorAttachmentPlatform,
			UserVerificationRequirement: winhello.WinHelloUserVerificationRequirementRequired,
			RequireResidentKey:          true,
		},
	)
	if err != nil {
		fail("MakeCredential (Windows Hello): %v", err)
	}
	fmt.Printf("[INFO] MakeCredential succeeded; PRFEnabled=%v\n", resp.PRFEnabled)
	if !resp.PRFEnabled {
		fail("the credential reports PRFEnabled=false — this Windows build/Hello does not support platform PRF")
	}
	if err := os.WriteFile(statePath(), []byte(base64.URLEncoding.EncodeToString(resp.CredentialID)), 0o600); err != nil {
		fmt.Printf("[WARN] could not persist credential id: %v\n", err)
	}
	return resp.CredentialID, true
}

func derivePRF(hWnd windows.HWND, credID, salt []byte) []byte {
	assertion, err := winhello.GetAssertion(
		hWnd,
		rpID,
		[]byte("{}"),
		[]webauthntypes.PublicKeyCredentialDescriptor{
			{ID: credID, Type: webauthntypes.PublicKeyCredentialTypePublicKey},
		},
		&webauthntypes.GetAuthenticationExtensionsClientInputs{
			PRFInputs: &webauthntypes.PRFInputs{
				PRF: webauthntypes.AuthenticationExtensionsPRFInputs{
					EvalByCredential: map[string]webauthntypes.AuthenticationExtensionsPRFValues{
						base64.URLEncoding.EncodeToString(credID): {First: salt},
					},
				},
			},
		},
		&winhello.AuthenticatorGetAssertionOptions{
			AuthenticatorAttachment:     winhello.WinHelloAuthenticatorAttachmentPlatform,
			UserVerificationRequirement: winhello.WinHelloUserVerificationRequirementRequired,
		},
	)
	if err != nil {
		fail("GetAssertion (Windows Hello): %v", err)
	}
	if !assertion.ExtensionOutputs.PRFOutputs.PRF.Enabled {
		fail("assertion did not return a PRF result (prf.enabled=false)")
	}
	return assertion.ExtensionOutputs.PRFOutputs.PRF.Results.First
}

func doCleanup(hWnd windows.HWND) {
	if data, err := os.ReadFile(statePath()); err == nil {
		if id, derr := base64.URLEncoding.DecodeString(string(bytes.TrimSpace(data))); derr == nil {
			if err := winhello.DeletePlatformCredential(id); err != nil {
				fmt.Printf("[WARN] DeletePlatformCredential: %v\n", err)
			} else {
				fmt.Println("[INFO] deleted spike credential from Windows Hello")
			}
		}
	}
	_ = os.Remove(statePath())
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

func statePath() string {
	exe, err := os.Executable()
	if err != nil {
		return stateFile
	}
	return filepath.Join(filepath.Dir(exe), stateFile)
}

func fail(format string, a ...any) {
	fmt.Printf("[FAIL] "+format+"\n", a...)
	os.Exit(1)
}

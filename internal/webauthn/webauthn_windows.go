//go:build windows

package webauthn

import (
	"errors"
	"fmt"
	"log/slog"
	"unsafe"

	"paddockcontrol-desktop/internal/logger"

	"github.com/go-ctap/ctaphid/pkg/webauthntypes"
	"github.com/go-ctap/winhello"
	"github.com/go-ctap/winhello/hiddenwindow"
	"github.com/ldclabs/cose/iana"
	"golang.org/x/sys/windows"
)

var (
	user32          = windows.NewLazySystemDLL("user32.dll")
	procFindWindowW = user32.NewProc("FindWindowW")
)

// nteNotSupported (NTE_NOT_SUPPORTED) is returned by Windows Hello / NGC when it
// can't create the platform credential — typically a software (non-TPM) Hello key.
const nteNotSupported = 0x80090029

// isErrno reports whether err is (or wraps) a windows.Errno with the given value.
func isErrno(err error, code uint32) bool {
	var errno windows.Errno
	return errors.As(err, &errno) && uint32(errno) == code
}

func transportsToStrings(ts []webauthntypes.AuthenticatorTransport) []string {
	out := make([]string, len(ts))
	for i, t := range ts {
		out[i] = string(t)
	}
	return out
}

func stringsToTransports(ss []string) []webauthntypes.AuthenticatorTransport {
	out := make([]webauthntypes.AuthenticatorTransport, len(ss))
	for i, s := range ss {
		out[i] = webauthntypes.AuthenticatorTransport(s)
	}
	return out
}

// Available reports whether the native Windows WebAuthn API is usable.
func Available() bool {
	return winhello.APIVersionNumber() > 0
}

// Enroll creates a passkey with the PRF extension enabled and returns its
// credential id, the secret derived for salt, and the transports the chosen
// authenticator used. The attachment is unconstrained: the user picks Windows
// Hello, a security key, or a phone at the OS dialog. It is requested as
// non-resident so a security key consumes no slot; Windows Hello stores a
// discoverable credential regardless, which it needs for hmac-secret.
func Enroll(windowTitle, rpID, rpName, userName string, salt []byte) (*Credential, error) {
	hWnd, cleanup, err := windowHandle(windowTitle, rpName)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	resp, err := winhello.MakeCredential(
		hWnd,
		[]byte("{}"),
		webauthntypes.PublicKeyCredentialRpEntity{ID: rpID, Name: rpName},
		webauthntypes.PublicKeyCredentialUserEntity{ID: []byte(userName), Name: userName, DisplayName: rpName},
		[]webauthntypes.PublicKeyCredentialParameters{
			{Type: webauthntypes.PublicKeyCredentialTypePublicKey, Algorithm: iana.AlgorithmES256},
		},
		nil,
		&webauthntypes.CreateAuthenticationExtensionsClientInputs{
			PRFInputs: &webauthntypes.PRFInputs{PRF: webauthntypes.AuthenticationExtensionsPRFInputs{
				Eval: &webauthntypes.AuthenticationExtensionsPRFValues{First: salt},
			}},
		},
		&winhello.AuthenticatorMakeCredentialOptions{
			AuthenticatorAttachment:     winhello.WinHelloAuthenticatorAttachmentAny,
			UserVerificationRequirement: winhello.WinHelloUserVerificationRequirementRequired,
			RequireResidentKey:          false,
		},
	)
	if err != nil {
		// A platform authenticator with no TPM-backed key returns NTE_NOT_SUPPORTED.
		if isErrno(err, nteNotSupported) {
			return nil, ErrPlatformAuthenticatorUnsupported
		}
		return nil, fmt.Errorf("make credential: %w", err)
	}
	if !resp.PRFEnabled {
		return nil, fmt.Errorf("the chosen authenticator does not support PRF")
	}

	transports := transportsToStrings(resp.UsedTransport)
	logger.WithComponent("webauthn").Info("passkey created",
		slog.Bool("prf_enabled", resp.PRFEnabled),
		slog.Any("used_transport", resp.UsedTransport),
		slog.Bool("resident_key", resp.ResidentKey),
	)

	// Always derive the wrapping secret via an assertion (get()), even though
	// creation may also return it: unlock derives via the same get() path, so
	// using one path for both guarantees the enroll and unlock secrets match.
	secret, err := derive(hWnd, rpID, resp.CredentialID, salt, resp.UsedTransport)
	if err != nil {
		return nil, err
	}
	return &Credential{CredentialID: resp.CredentialID, Secret: secret, Transports: transports}, nil
}

// Derive re-derives the PRF secret for an existing credential id + salt. The
// stored transports route the prompt straight to the authenticator that holds
// the credential, so Windows skips the device chooser.
func Derive(windowTitle, rpID string, credentialID, salt []byte, transports []string) ([]byte, error) {
	hWnd, cleanup, err := windowHandle(windowTitle, rpID)
	if err != nil {
		return nil, err
	}
	defer cleanup()
	return derive(hWnd, rpID, credentialID, salt, stringsToTransports(transports))
}

func derive(hWnd windows.HWND, rpID string, credentialID, salt []byte, transports []webauthntypes.AuthenticatorTransport) ([]byte, error) {
	descriptor := webauthntypes.PublicKeyCredentialDescriptor{
		ID:         credentialID,
		Type:       webauthntypes.PublicKeyCredentialTypePublicKey,
		Transports: transports,
	}

	logger.WithComponent("webauthn").Info("deriving PRF via assertion",
		slog.Int("transports", len(transports)),
	)

	assertion, err := winhello.GetAssertion(
		hWnd,
		rpID,
		[]byte("{}"),
		[]webauthntypes.PublicKeyCredentialDescriptor{descriptor},
		&webauthntypes.GetAuthenticationExtensionsClientInputs{
			// Raw hmac-secret (not PRFInputs): on Windows Hello the assertion only
			// evaluates the salt on this path, and the wrapper returns the output
			// here. salt must be exactly SecretLen bytes for the raw extension.
			GetHMACSecretInputs: &webauthntypes.GetHMACSecretInputs{
				HMACGetSecret: webauthntypes.HMACGetSecretInput{Salt1: salt},
			},
		},
		&winhello.AuthenticatorGetAssertionOptions{
			UserVerificationRequirement: winhello.WinHelloUserVerificationRequirementRequired,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("get assertion: %w", err)
	}
	out := assertion.ExtensionOutputs
	if out == nil || out.GetHMACSecretOutputs == nil {
		return nil, fmt.Errorf("assertion returned no hmac-secret output")
	}
	secret := out.GetHMACSecretOutputs.HMACGetSecret.Output1
	if len(secret) != SecretLen {
		return nil, fmt.Errorf("unexpected hmac-secret length %d", len(secret))
	}
	return secret, nil
}

// windowHandle returns the app's top-level window so the WebAuthn dialog is
// parented to it (correct focus/positioning). It falls back to a transient
// hidden window if the app window can't be located.
func windowHandle(title, fallbackName string) (windows.HWND, func(), error) {
	if h := appWindowHandle(title); h != 0 {
		return h, func() {}, nil
	}
	wnd, err := hiddenwindow.New(slog.New(slog.DiscardHandler), fallbackName)
	if err != nil {
		return 0, nil, fmt.Errorf("create window: %w", err)
	}
	return wnd.WindowHandle(), func() { wnd.Close() }, nil
}

// appWindowHandle finds the app's top-level window: the foreground window (which
// is the app's, since enroll/unlock are triggered by a user action in it),
// validated; otherwise by exact title.
func appWindowHandle(title string) windows.HWND {
	if h := windows.GetForegroundWindow(); h != 0 && windows.IsWindow(h) {
		return h
	}
	return findWindowByTitle(title)
}

func findWindowByTitle(title string) windows.HWND {
	p, err := windows.UTF16PtrFromString(title)
	if err != nil {
		return 0
	}
	r, _, _ := procFindWindowW.Call(0, uintptr(unsafe.Pointer(p)))
	return windows.HWND(r)
}

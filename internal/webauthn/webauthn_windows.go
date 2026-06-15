//go:build windows

package webauthn

import (
	"encoding/base64"
	"fmt"
	"log/slog"
	"unsafe"

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

// Available reports whether the native Windows WebAuthn API is usable.
func Available() bool {
	return winhello.APIVersionNumber() > 0
}

// Enroll creates a NON-resident passkey (the user picks Windows Hello or a
// security key) with the PRF extension enabled, and returns its credential id
// plus the secret derived for salt. windowTitle is the app's top-level window
// title, used to parent the Windows Hello / security-key dialog.
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
			// AuthenticatorAttachment unset → the OS offers both platform (Hello)
			// and roaming (security key) options.
			UserVerificationRequirement: winhello.WinHelloUserVerificationRequirementRequired,
			RequireResidentKey:          false, // non-resident
		},
	)
	if err != nil {
		return nil, fmt.Errorf("make credential: %w", err)
	}
	if !resp.PRFEnabled {
		return nil, fmt.Errorf("the chosen authenticator does not support PRF")
	}

	// Modern Windows returns the PRF/hmac-secret straight from credential creation
	// (we passed the salt as the global eval), so enrollment is a single ceremony.
	// hmac-secret is deterministic for a (credential, salt) pair, so this matches
	// what unlock re-derives via an assertion. Older Windows leaves it nil → fall
	// back to a second (assertion) ceremony to obtain the secret.
	if resp.HMACSecret != nil && len(resp.HMACSecret.First) == SecretLen {
		return &Credential{CredentialID: resp.CredentialID, Secret: resp.HMACSecret.First}, nil
	}

	secret, err := derive(hWnd, rpID, resp.CredentialID, salt)
	if err != nil {
		return nil, err
	}
	return &Credential{CredentialID: resp.CredentialID, Secret: secret}, nil
}

// Derive re-derives the PRF secret for an existing credential id + salt.
func Derive(windowTitle, rpID string, credentialID, salt []byte) ([]byte, error) {
	hWnd, cleanup, err := windowHandle(windowTitle, rpID)
	if err != nil {
		return nil, err
	}
	defer cleanup()
	return derive(hWnd, rpID, credentialID, salt)
}

func derive(hWnd windows.HWND, rpID string, credentialID, salt []byte) ([]byte, error) {
	assertion, err := winhello.GetAssertion(
		hWnd,
		rpID,
		[]byte("{}"),
		[]webauthntypes.PublicKeyCredentialDescriptor{
			{ID: credentialID, Type: webauthntypes.PublicKeyCredentialTypePublicKey},
		},
		&webauthntypes.GetAuthenticationExtensionsClientInputs{
			PRFInputs: &webauthntypes.PRFInputs{PRF: webauthntypes.AuthenticationExtensionsPRFInputs{
				EvalByCredential: map[string]webauthntypes.AuthenticationExtensionsPRFValues{
					base64.URLEncoding.EncodeToString(credentialID): {First: salt},
				},
			}},
		},
		&winhello.AuthenticatorGetAssertionOptions{
			UserVerificationRequirement: winhello.WinHelloUserVerificationRequirementRequired,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("get assertion: %w", err)
	}
	if !assertion.ExtensionOutputs.PRFOutputs.PRF.Enabled {
		return nil, fmt.Errorf("assertion returned no PRF result")
	}
	secret := assertion.ExtensionOutputs.PRFOutputs.PRF.Results.First
	if len(secret) != SecretLen {
		return nil, fmt.Errorf("unexpected PRF secret length %d", len(secret))
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

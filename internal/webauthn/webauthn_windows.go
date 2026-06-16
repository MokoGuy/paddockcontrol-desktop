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

// Available reports whether the native Windows WebAuthn API is usable.
func Available() bool {
	return winhello.APIVersionNumber() > 0
}

// Enroll creates a NON-resident passkey with the PRF extension enabled and
// returns its credential id plus the secret derived for salt. windowTitle is the
// app's top-level window title, used to parent the dialog. platform selects the
// authenticator class: true constrains to the built-in platform authenticator
// (Windows Hello / this device), false to a roaming one (security key) — so each
// enrollment path shows a single, unambiguous Windows prompt.
func Enroll(windowTitle, rpID, rpName, userName string, salt []byte, platform bool) (*Credential, error) {
	hWnd, cleanup, err := windowHandle(windowTitle, rpName)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	attachment := winhello.WinHelloAuthenticatorAttachmentCrossPlatform
	if platform {
		attachment = winhello.WinHelloAuthenticatorAttachmentPlatform
	}

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
			AuthenticatorAttachment:     attachment,
			UserVerificationRequirement: winhello.WinHelloUserVerificationRequirementRequired,
			// Windows Hello requires a resident/discoverable credential to support
			// hmac-secret; a roaming security key stays non-resident (no slot used).
			RequireResidentKey: platform,
		},
	)
	if err != nil {
		// Windows Hello without a TPM-backed key returns NTE_NOT_SUPPORTED for the
		// platform credential. (Often the OS masks it by falling back to the device
		// chooser, so this only fires when the error surfaces directly.)
		if platform && isErrno(err, nteNotSupported) {
			return nil, ErrPlatformAuthenticatorUnsupported
		}
		return nil, fmt.Errorf("make credential: %w", err)
	}
	if !resp.PRFEnabled {
		return nil, fmt.Errorf("the chosen authenticator does not support PRF")
	}

	hmacLen := 0
	if resp.HMACSecret != nil {
		hmacLen = len(resp.HMACSecret.First)
	}
	log := logger.WithComponent("webauthn")
	log.Info("passkey created",
		slog.Bool("platform_requested", platform),
		slog.Int("attachment_requested", int(attachment)),
		slog.Bool("prf_enabled", resp.PRFEnabled),
		slog.Bool("hmac_secret_at_create", hmacLen == SecretLen),
		slog.Int("hmac_secret_len", hmacLen),
		slog.Any("used_transport", resp.UsedTransport),
		slog.Bool("resident_key", resp.ResidentKey),
	)

	// Always derive the wrapping secret via an assertion (get()), even though
	// creation may also return it: unlock derives via the same get() path, so
	// using one path for both guarantees the enroll and unlock secrets match.
	secret, err := derive(hWnd, rpID, resp.CredentialID, salt, platform)
	if err != nil {
		return nil, err
	}
	return &Credential{CredentialID: resp.CredentialID, Secret: secret}, nil
}

// Derive re-derives the PRF secret for an existing credential id + salt. platform
// selects the authenticator class (Windows Hello vs security key) so the prompt
// goes straight to it without a device chooser.
func Derive(windowTitle, rpID string, credentialID, salt []byte, platform bool) ([]byte, error) {
	hWnd, cleanup, err := windowHandle(windowTitle, rpID)
	if err != nil {
		return nil, err
	}
	defer cleanup()
	return derive(hWnd, rpID, credentialID, salt, platform)
}

func derive(hWnd windows.HWND, rpID string, credentialID, salt []byte, platform bool) ([]byte, error) {
	attachment := winhello.WinHelloAuthenticatorAttachmentCrossPlatform
	descriptor := webauthntypes.PublicKeyCredentialDescriptor{
		ID:   credentialID,
		Type: webauthntypes.PublicKeyCredentialTypePublicKey,
	}
	if platform {
		attachment = winhello.WinHelloAuthenticatorAttachmentPlatform
		// Internal transport tells Windows the credential lives on this device, so
		// it skips the "phone / security key" chooser.
		descriptor.Transports = []webauthntypes.AuthenticatorTransport{
			webauthntypes.AuthenticatorTransportInternal,
		}
	}

	logger.WithComponent("webauthn").Info("deriving PRF via assertion",
		slog.Bool("platform", platform),
		slog.Int("attachment", int(attachment)),
		slog.Int("transports", len(descriptor.Transports)),
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
			AuthenticatorAttachment:     attachment,
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

//go:build windows

package webauthn

import (
	"encoding/base64"
	"fmt"
	"log/slog"

	"github.com/go-ctap/ctaphid/pkg/webauthntypes"
	"github.com/go-ctap/winhello"
	"github.com/go-ctap/winhello/hiddenwindow"
	"github.com/ldclabs/cose/iana"
	"golang.org/x/sys/windows"
)

// Available reports whether the native Windows WebAuthn API is usable.
func Available() bool {
	return winhello.APIVersionNumber() > 0
}

// Enroll creates a NON-resident passkey (the user picks Windows Hello or a
// security key) with the PRF extension enabled, and returns its credential id
// plus the secret derived for salt. Non-resident means nothing is stored on the
// authenticator: we hold the credential id and pass it back on every Derive.
func Enroll(rpID, rpName, userName string, salt []byte) (*Credential, error) {
	wnd, err := hiddenwindow.New(slog.New(slog.DiscardHandler), rpName)
	if err != nil {
		return nil, fmt.Errorf("create window: %w", err)
	}
	defer wnd.Close()
	hWnd := wnd.WindowHandle()

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

	secret, err := derive(hWnd, rpID, resp.CredentialID, salt)
	if err != nil {
		return nil, err
	}
	return &Credential{CredentialID: resp.CredentialID, Secret: secret}, nil
}

// Derive re-derives the PRF secret for an existing credential id + salt.
func Derive(rpID string, credentialID, salt []byte) ([]byte, error) {
	wnd, err := hiddenwindow.New(slog.New(slog.DiscardHandler), rpID)
	if err != nil {
		return nil, fmt.Errorf("create window: %w", err)
	}
	defer wnd.Close()
	return derive(wnd.WindowHandle(), rpID, credentialID, salt)
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

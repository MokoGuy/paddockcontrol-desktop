// Package webauthn wraps the native platform WebAuthn API to derive a stable
// PRF/hmac-secret secret from a passkey (Windows Hello platform authenticator or
// a roaming FIDO2 security key) that is used to envelope-encrypt the master key.
//
// The real implementation is Windows-only (webauthn.dll via go-ctap/winhello,
// CGO-free). Other platforms get a stub that reports unavailable.
package webauthn

import "errors"

// SecretLen is the length of the PRF-derived wrapping key (a 32-byte KEK).
const SecretLen = 32

// ErrUnsupported is returned on platforms without native WebAuthn support.
var ErrUnsupported = errors.New("platform WebAuthn is not supported on this OS")

// ErrPlatformAuthenticatorUnsupported is returned when the OS platform
// authenticator (Windows Hello) cannot create the requested credential — most
// often because Windows Hello is not backed by a TPM on this machine, so it
// produces software keys that can't store passkeys (NGC MakeCredential returns
// NTE_NOT_SUPPORTED, 0x80090029). The roaming/security-key path still works.
var ErrPlatformAuthenticatorUnsupported = errors.New("the platform authenticator (Windows Hello) cannot create a passkey on this device")

// ErrCredentialAlreadyEnrolled is returned when enrollment targets an
// authenticator that already holds one of our passkeys (excludeCredentials
// match) — e.g. trying to add a second Windows Hello on the same machine, which
// would otherwise overwrite the first on the TPM.
var ErrCredentialAlreadyEnrolled = errors.New("this authenticator already has a passkey enrolled")

// Credential is the result of a successful Enroll: the credential id (stored and
// passed back on every Derive), the derived secret, and the authenticator
// transports actually used — which both label the method (Windows Hello vs a
// security key) and route the unlock prompt straight to the right authenticator.
type Credential struct {
	CredentialID []byte
	Secret       []byte // SecretLen bytes
	Transports   []string
}

// LabelForTransports names a passkey from the authenticator it was created on.
func LabelForTransports(transports []string) string {
	for _, t := range transports {
		switch t {
		case "internal":
			return "Windows Hello"
		case "usb", "nfc", "ble", "smart-card":
			return "Security key"
		case "hybrid":
			return "Phone or tablet"
		}
	}
	return "Passkey"
}

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

// Credential is the result of a successful Enroll: the credential id (which we
// store and pass back on every Derive — the credential is non-resident, so
// nothing is stored on the authenticator) plus the derived secret.
type Credential struct {
	CredentialID []byte
	Secret       []byte // SecretLen bytes
}

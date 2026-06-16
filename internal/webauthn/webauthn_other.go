//go:build !windows

package webauthn

// Available reports false on platforms without a native WebAuthn implementation.
func Available() bool { return false }

// Enroll is unsupported off Windows.
func Enroll(windowTitle, rpID, rpName, userName string, salt []byte, excludeCredentialIDs [][]byte) (*Credential, error) {
	return nil, ErrUnsupported
}

// Assert is unsupported off Windows.
func Assert(windowTitle, rpID string, allowed []AllowedCredential, salt []byte) (credentialID, secret []byte, err error) {
	return nil, nil, ErrUnsupported
}

// Derive is unsupported off Windows.
func Derive(windowTitle, rpID string, credentialID, salt []byte, transports []string) ([]byte, error) {
	return nil, ErrUnsupported
}

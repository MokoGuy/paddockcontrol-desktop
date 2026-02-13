//go:build !windows && !linux

package keystore

import "fmt"

type unsupportedKeystore struct{}

// New returns a stub keystore on unsupported platforms.
func New() Keystore {
	return &unsupportedKeystore{}
}

func (k *unsupportedKeystore) Store(_, _ string, _ []byte) error {
	return fmt.Errorf("OS keyring not supported on this platform")
}

func (k *unsupportedKeystore) Retrieve(_, _ string) ([]byte, error) {
	return nil, fmt.Errorf("OS keyring not supported on this platform")
}

func (k *unsupportedKeystore) Delete(_, _ string) error {
	return fmt.Errorf("OS keyring not supported on this platform")
}

func (k *unsupportedKeystore) Available() bool {
	return false
}

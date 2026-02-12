//go:build windows || linux

package keystore

import (
	"encoding/base64"
	"fmt"

	gokeyring "github.com/zalando/go-keyring"
)

type desktopKeystore struct{}

// New returns the OS-native keystore for the current platform.
func New() Keystore {
	return &desktopKeystore{}
}

func (k *desktopKeystore) Store(service, account string, data []byte) error {
	// go-keyring stores strings, so base64-encode binary data
	encoded := base64.StdEncoding.EncodeToString(data)
	if err := gokeyring.Set(service, account, encoded); err != nil {
		return fmt.Errorf("keystore store failed: %w", err)
	}
	return nil
}

func (k *desktopKeystore) Retrieve(service, account string) ([]byte, error) {
	encoded, err := gokeyring.Get(service, account)
	if err != nil {
		return nil, fmt.Errorf("keystore retrieve failed: %w", err)
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("keystore decode failed: %w", err)
	}
	return data, nil
}

func (k *desktopKeystore) Delete(service, account string) error {
	if err := gokeyring.Delete(service, account); err != nil {
		return fmt.Errorf("keystore delete failed: %w", err)
	}
	return nil
}

func (k *desktopKeystore) Available() bool {
	// Test availability by attempting a small operation
	testKey := service + "-availability-test"
	err := gokeyring.Set(service, testKey, "test")
	if err != nil {
		return false
	}
	_ = gokeyring.Delete(service, testKey)
	return true
}

const service = ServiceName

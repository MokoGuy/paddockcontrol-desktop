package crypto

import (
	"crypto/rand"
	"fmt"
	"io"

	"golang.org/x/crypto/argon2"
)

// Argon2idParams holds the parameters for Argon2id key derivation.
type Argon2idParams struct {
	Memory      uint32 `json:"argon2_memory"`      // KiB
	Iterations  uint32 `json:"argon2_iterations"`
	Parallelism uint8  `json:"argon2_parallelism"`
	KeyLength   uint32 `json:"key_length"`
	SaltLength  uint32 `json:"salt_length"`
}

// DefaultArgon2idParams returns OWASP-recommended Argon2id parameters.
func DefaultArgon2idParams() Argon2idParams {
	return Argon2idParams{
		Memory:      64 * 1024, // 64 MiB
		Iterations:  3,
		Parallelism: 4,
		KeyLength:   32,
		SaltLength:  16,
	}
}

// GenerateSalt generates a cryptographically random salt.
func GenerateSalt(length uint32) ([]byte, error) {
	salt := make([]byte, length)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return nil, fmt.Errorf("failed to generate salt: %w", err)
	}
	return salt, nil
}

// DeriveKeyFromPassword derives a wrapping key from a password using Argon2id.
func DeriveKeyFromPassword(password string, salt []byte, params Argon2idParams) []byte {
	return argon2.IDKey(
		[]byte(password),
		salt,
		params.Iterations,
		params.Memory,
		params.Parallelism,
		params.KeyLength,
	)
}

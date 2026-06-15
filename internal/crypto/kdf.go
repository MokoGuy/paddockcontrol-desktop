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

// Validate enforces lower bounds on Argon2id parameters. It guards against
// derivation from absent/zero metadata (which would otherwise panic inside
// argon2.IDKey when iterations or parallelism are 0) and against a tampered
// database silently downgrading the KDF cost to make cracking cheap.
func (p Argon2idParams) Validate() error {
	// 19 MiB is the OWASP minimum for Argon2id; the app default is 64 MiB.
	if p.Memory < 19*1024 {
		return fmt.Errorf("argon2id memory too low: %d KiB", p.Memory)
	}
	if p.Iterations < 1 {
		return fmt.Errorf("argon2id iterations too low: %d", p.Iterations)
	}
	if p.Parallelism < 1 {
		return fmt.Errorf("argon2id parallelism too low: %d", p.Parallelism)
	}
	if p.KeyLength != 32 {
		return fmt.Errorf("argon2id key length must be 32, got %d", p.KeyLength)
	}
	if p.SaltLength < 16 {
		return fmt.Errorf("argon2id salt too short: %d bytes", p.SaltLength)
	}
	return nil
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

package crypto

import (
	"testing"
)

func TestDefaultArgon2idParams(t *testing.T) {
	params := DefaultArgon2idParams()
	if params.Memory != 64*1024 {
		t.Errorf("expected memory 64 MiB (65536 KiB), got %d", params.Memory)
	}
	if params.Iterations != 3 {
		t.Errorf("expected 3 iterations, got %d", params.Iterations)
	}
	if params.Parallelism != 4 {
		t.Errorf("expected 4 parallelism, got %d", params.Parallelism)
	}
	if params.KeyLength != 32 {
		t.Errorf("expected 32 key length, got %d", params.KeyLength)
	}
	if params.SaltLength != 16 {
		t.Errorf("expected 16 salt length, got %d", params.SaltLength)
	}
}

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

func TestArgon2idParams_Validate(t *testing.T) {
	if err := DefaultArgon2idParams().Validate(); err != nil {
		t.Fatalf("default params should be valid, got %v", err)
	}

	cases := map[string]Argon2idParams{
		"zero (absent metadata)": {},
		"zero iterations":        {Memory: 64 * 1024, Iterations: 0, Parallelism: 4, KeyLength: 32, SaltLength: 16},
		"zero parallelism":       {Memory: 64 * 1024, Iterations: 3, Parallelism: 0, KeyLength: 32, SaltLength: 16},
		"downgraded memory":      {Memory: 8, Iterations: 3, Parallelism: 4, KeyLength: 32, SaltLength: 16},
		"wrong key length":       {Memory: 64 * 1024, Iterations: 3, Parallelism: 4, KeyLength: 16, SaltLength: 16},
		"short salt":             {Memory: 64 * 1024, Iterations: 3, Parallelism: 4, KeyLength: 32, SaltLength: 8},
	}
	for name, p := range cases {
		if err := p.Validate(); err == nil {
			t.Errorf("%s: expected validation error, got nil", name)
		}
	}
}

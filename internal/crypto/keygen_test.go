package crypto

import (
	"testing"
)

func TestGenerateRSAKey(t *testing.T) {
	tests := []struct {
		name    string
		keySize int
		wantErr bool
	}{
		{"2048-bit key", 2048, false},
		{"3072-bit key", 3072, false},
		{"4096-bit key", 4096, false},
		{"too small key", 1024, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key, err := GenerateRSAKey(tt.keySize)
			if (err != nil) != tt.wantErr {
				t.Errorf("GenerateRSAKey() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && key == nil {
				t.Error("GenerateRSAKey() returned nil key")
			}
			if !tt.wantErr && key.N.BitLen() != tt.keySize {
				t.Errorf("GenerateRSAKey() key size = %d, want %d", key.N.BitLen(), tt.keySize)
			}
		})
	}
}

func BenchmarkGenerateRSAKey2048(b *testing.B) {
	for b.Loop() {
		_, _ = GenerateRSAKey(2048)
	}
}

func BenchmarkGenerateRSAKey3072(b *testing.B) {
	for b.Loop() {
		_, _ = GenerateRSAKey(3072)
	}
}

func BenchmarkGenerateRSAKey4096(b *testing.B) {
	for b.Loop() {
		_, _ = GenerateRSAKey(4096)
	}
}

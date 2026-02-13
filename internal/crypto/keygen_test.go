package crypto

import (
	"testing"
)

func TestGenerateRSAKey_RejectsUndersizedKey(t *testing.T) {
	_, err := GenerateRSAKey(1024)
	if err == nil {
		t.Fatal("GenerateRSAKey(1024) should reject keys below 2048 bits")
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

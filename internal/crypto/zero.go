package crypto

// Zero overwrites a byte slice with zeros. Use it (typically via defer) to wipe
// plaintext key material — raw master keys, derived wrapping keys, decrypted
// private keys — as soon as it is no longer needed, to shorten its lifetime in
// memory.
//
// This is best-effort: Go's GC may have already copied the backing array, and
// there is no protection against swap or core dumps. For stronger guarantees on
// supported platforms, sensitive regions could later be wrapped in
// runtime/secret.Do (Go 1.26, experimental, linux only).
// TODO(go1.26): evaluate runtime/secret for the re-encryption hot paths.
func Zero(b []byte) {
	clear(b)
}

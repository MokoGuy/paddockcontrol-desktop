package logger

// Audit records a security-relevant event under the "audit" component at Info
// level, so it is persisted (Info is written in production) and easy to grep
// (component=audit). The message is the event name.
//
// NEVER pass secrets (master key, PRF/wrapping secrets, wrapped material) as
// attributes — only non-sensitive metadata (ids, labels, methods, transports).
func Audit(event string, attrs ...any) {
	WithComponent("audit").Info(event, attrs...)
}

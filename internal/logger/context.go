package logger

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
)

// contextKey is a type for context keys to avoid collisions
type contextKey string

const (
	// OperationIDKey is the context key for operation IDs
	OperationIDKey contextKey = "op_id"
)

// GenerateOperationID creates a unique 8-character hex operation ID
func GenerateOperationID() string {
	bytes := make([]byte, 4)
	_, _ = rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// WithOperation creates a new context with an operation ID and returns a logger
// with the operation ID and operation name attached.
// Use this at the start of user-initiated operations for traceability.
func WithOperation(ctx context.Context, operation string) (context.Context, *slog.Logger) {
	opID := GenerateOperationID()
	ctx = context.WithValue(ctx, OperationIDKey, opID)

	log := Default().With(
		slog.String("op_id", opID),
		slog.String("operation", operation),
	)

	return ctx, log
}

// WithComponent returns a logger with a component name attached.
// Use this for logging within a specific package/service.
func WithComponent(component string) *slog.Logger {
	return Default().With(slog.String("component", component))
}

// FromContext extracts the operation ID from context and returns a logger with it.
// If no operation ID exists, returns the default logger.
func FromContext(ctx context.Context) *slog.Logger {
	if opID, ok := ctx.Value(OperationIDKey).(string); ok {
		return Default().With(slog.String("op_id", opID))
	}
	return Default()
}

// WithHostname returns a new logger with hostname attached.
// Use this for certificate-related operations.
func WithHostname(log *slog.Logger, hostname string) *slog.Logger {
	return log.With(slog.String("hostname", hostname))
}

// With returns a new logger with the given attributes attached.
// Convenience wrapper for chaining attributes.
func With(attrs ...any) *slog.Logger {
	return Default().With(attrs...)
}

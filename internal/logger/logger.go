package logger

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"

	"gopkg.in/natefinch/lumberjack.v2"
)

var (
	// defaultLogger is the package-level logger instance
	defaultLogger *slog.Logger

	// logsDir stores the logs directory path for export functionality
	logsDir string

	// logWriter is the lumberjack writer for production mode
	logWriter *lumberjack.Logger
)

// Initialize sets up structured logging based on build mode
func Initialize(dataDir string, production bool) error {
	logsDir = filepath.Join(dataDir, "logs")

	// Always create logs directory for export functionality
	if err := os.MkdirAll(logsDir, 0700); err != nil {
		return fmt.Errorf("failed to create logs directory: %w", err)
	}

	// Always set up file logging with rotation
	logWriter = &lumberjack.Logger{
		Filename:   filepath.Join(logsDir, "paddockcontrol.log"),
		MaxSize:    10,   // MB
		MaxBackups: 5,    // Keep 5 old log files
		MaxAge:     30,   // Days
		Compress:   true, // Compress old logs
	}

	var handler slog.Handler

	if production {
		// Production: JSON logs to file only
		handler = slog.NewJSONHandler(logWriter, &slog.HandlerOptions{
			Level:     slog.LevelInfo,
			AddSource: true,
		})
	} else {
		// Development: colored text to stdout + JSON to file (multi-writer)
		handler = newMultiHandler(
			newColoredHandler(os.Stdout, &slog.HandlerOptions{
				Level:     slog.LevelDebug,
				AddSource: true,
			}),
			slog.NewJSONHandler(logWriter, &slog.HandlerOptions{
				Level:     slog.LevelDebug,
				AddSource: true,
			}),
		)
	}

	defaultLogger = slog.New(handler)
	slog.SetDefault(defaultLogger)

	return nil
}

// Default returns the default logger instance
func Default() *slog.Logger {
	if defaultLogger == nil {
		// Fallback to a basic logger if not initialized
		return slog.Default()
	}
	return defaultLogger
}

// GetLogsDirectory returns the logs directory path
func GetLogsDirectory() string {
	return logsDir
}

// Sync flushes any buffered log entries (for lumberjack)
func Sync() error {
	if logWriter != nil {
		return logWriter.Close()
	}
	return nil
}

// coloredHandler wraps slog.TextHandler with ANSI colors for development
type coloredHandler struct {
	slog.Handler
	w io.Writer
}

func newColoredHandler(w io.Writer, opts *slog.HandlerOptions) *coloredHandler {
	return &coloredHandler{
		Handler: slog.NewTextHandler(w, opts),
		w:       w,
	}
}

func (h *coloredHandler) Handle(ctx context.Context, r slog.Record) error {
	// Add color prefix based on level
	var color string
	switch r.Level {
	case slog.LevelDebug:
		color = "\033[35m" // Magenta
	case slog.LevelInfo:
		color = "\033[36m" // Cyan
	case slog.LevelWarn:
		color = "\033[33m" // Yellow
	case slog.LevelError:
		color = "\033[31m" // Red
	default:
		color = "\033[0m" // Reset
	}

	// Print colored level prefix
	fmt.Fprintf(h.w, "%s", color)
	err := h.Handler.Handle(ctx, r)
	fmt.Fprintf(h.w, "\033[0m")
	return err
}

// multiHandler writes to multiple slog handlers
type multiHandler struct {
	handlers []slog.Handler
}

func newMultiHandler(handlers ...slog.Handler) *multiHandler {
	return &multiHandler{handlers: handlers}
}

func (h *multiHandler) Enabled(ctx context.Context, level slog.Level) bool {
	for _, handler := range h.handlers {
		if handler.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

func (h *multiHandler) Handle(ctx context.Context, r slog.Record) error {
	for _, handler := range h.handlers {
		if handler.Enabled(ctx, r.Level) {
			if err := handler.Handle(ctx, r.Clone()); err != nil {
				return err
			}
		}
	}
	return nil
}

func (h *multiHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	handlers := make([]slog.Handler, len(h.handlers))
	for i, handler := range h.handlers {
		handlers[i] = handler.WithAttrs(attrs)
	}
	return &multiHandler{handlers: handlers}
}

func (h *multiHandler) WithGroup(name string) slog.Handler {
	handlers := make([]slog.Handler, len(h.handlers))
	for i, handler := range h.handlers {
		handlers[i] = handler.WithGroup(name)
	}
	return &multiHandler{handlers: handlers}
}

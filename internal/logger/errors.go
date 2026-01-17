package logger

import (
	"fmt"
	"log/slog"
	"runtime"
)

// Err returns an slog.Attr for error logging with type information.
// Use this for structured error logging.
func Err(err error) slog.Attr {
	if err == nil {
		return slog.Attr{}
	}
	return slog.Group("error",
		slog.String("msg", err.Error()),
		slog.String("type", fmt.Sprintf("%T", err)),
	)
}

// ErrAttr returns a simple error attribute without grouping.
// Use this when you just need the error message as an attribute.
func ErrAttr(err error) slog.Attr {
	if err == nil {
		return slog.Attr{}
	}
	return slog.Any("error", err)
}

// CallerInfo returns file and line number of the caller.
// Skip specifies how many stack frames to skip (0 = caller of CallerInfo).
func CallerInfo(skip int) (file string, line int) {
	_, file, line, ok := runtime.Caller(skip + 1)
	if !ok {
		return "unknown", 0
	}
	// Get just the filename, not the full path
	for i := len(file) - 1; i >= 0; i-- {
		if file[i] == '/' {
			file = file[i+1:]
			break
		}
	}
	return file, line
}

// StackTrace returns a slice of stack frame information.
// maxFrames limits how many frames to capture.
func StackTrace(maxFrames int) []string {
	pcs := make([]uintptr, maxFrames)
	n := runtime.Callers(2, pcs) // Skip Callers and StackTrace
	if n == 0 {
		return nil
	}

	frames := runtime.CallersFrames(pcs[:n])
	stack := make([]string, 0, n)

	for {
		frame, more := frames.Next()
		stack = append(stack, fmt.Sprintf("%s:%d %s", frame.File, frame.Line, frame.Function))
		if !more {
			break
		}
	}

	return stack
}

// ErrorWithStack logs an error with stack trace at Error level.
// Use this for unexpected errors where stack context is valuable.
func ErrorWithStack(log *slog.Logger, msg string, err error) {
	stack := StackTrace(10)
	log.Error(msg,
		Err(err),
		slog.Any("stack", stack),
	)
}

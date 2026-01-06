package logger

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"gopkg.in/natefinch/lumberjack.v2"
)

var (
	InfoLogger  *log.Logger
	ErrorLogger *log.Logger
	DebugLogger *log.Logger
)

// Initialize sets up logging based on build mode
func Initialize(dataDir string, production bool) error {
	if production {
		// Production: Log to file with rotation
		logsDir := filepath.Join(dataDir, "logs")

		// Create logs directory
		if err := os.MkdirAll(logsDir, 0700); err != nil {
			return fmt.Errorf("failed to create logs directory: %w", err)
		}

		logFile := filepath.Join(logsDir, "paddockcontrol.log")

		logWriter := &lumberjack.Logger{
			Filename:   logFile,
			MaxSize:    10,   // MB
			MaxBackups: 5,    // Keep 5 old log files
			MaxAge:     30,   // Days
			Compress:   true, // Compress old logs
		}

		InfoLogger = log.New(logWriter, "INFO: ", log.Ldate|log.Ltime|log.Lshortfile)
		ErrorLogger = log.New(logWriter, "ERROR: ", log.Ldate|log.Ltime|log.Lshortfile)
		DebugLogger = log.New(logWriter, "DEBUG: ", log.Ldate|log.Ltime|log.Lshortfile)
	} else {
		// Development: Log to stdout with ANSI colors
		InfoLogger = log.New(os.Stdout, "\033[36mINFO:\033[0m ", log.Ltime|log.Lshortfile)
		ErrorLogger = log.New(os.Stderr, "\033[31mERROR:\033[0m ", log.Ltime|log.Lshortfile)
		DebugLogger = log.New(os.Stdout, "\033[35mDEBUG:\033[0m ", log.Ltime|log.Lshortfile)
	}

	return nil
}

// Helper functions for convenient logging

// Info logs an info level message
func Info(format string, v ...interface{}) {
	InfoLogger.Printf(format, v...)
}

// Error logs an error level message
func Error(format string, v ...interface{}) {
	ErrorLogger.Printf(format, v...)
}

// Debug logs a debug level message
func Debug(format string, v ...interface{}) {
	DebugLogger.Printf(format, v...)
}

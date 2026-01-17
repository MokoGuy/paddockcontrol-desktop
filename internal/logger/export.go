package logger

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// LogFileInfo contains information about the log files
type LogFileInfo struct {
	CurrentLogSize  int64  `json:"currentLogSize"`
	RotatedLogCount int    `json:"rotatedLogCount"`
	TotalLogsSize   int64  `json:"totalLogsSize"`
	OldestLogDate   *int64 `json:"oldestLogDate,omitempty"`
	LogsDirectory   string `json:"logsDirectory"`
}

// GetLogFileInfo returns information about all log files
func GetLogFileInfo() (*LogFileInfo, error) {
	if logsDir == "" {
		return nil, fmt.Errorf("logger not initialized")
	}

	info := &LogFileInfo{
		LogsDirectory: logsDir,
	}

	// Check if logs directory exists
	if _, err := os.Stat(logsDir); os.IsNotExist(err) {
		return info, nil
	}

	var oldestTime *time.Time

	err := filepath.Walk(logsDir, func(path string, fileInfo os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if fileInfo.IsDir() {
			return nil
		}

		// Only count log files
		name := fileInfo.Name()
		if !strings.HasPrefix(name, "paddockcontrol") {
			return nil
		}

		info.TotalLogsSize += fileInfo.Size()

		// Check if it's the current log or a rotated one
		if name == "paddockcontrol.log" {
			info.CurrentLogSize = fileInfo.Size()
		} else if strings.HasSuffix(name, ".log.gz") || strings.Contains(name, ".log-") {
			info.RotatedLogCount++
		}

		// Track oldest file
		modTime := fileInfo.ModTime()
		if oldestTime == nil || modTime.Before(*oldestTime) {
			oldestTime = &modTime
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to scan logs directory: %w", err)
	}

	if oldestTime != nil {
		unix := oldestTime.Unix()
		info.OldestLogDate = &unix
	}

	return info, nil
}

// ExportLogs creates a ZIP archive of all log files at the specified output path
func ExportLogs(outputPath string) error {
	if logsDir == "" {
		return fmt.Errorf("logger not initialized")
	}

	// Create the ZIP file
	zipFile, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create archive: %w", err)
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	// Check if logs directory exists
	if _, err := os.Stat(logsDir); os.IsNotExist(err) {
		// Create a note file in the archive explaining no logs exist yet
		writer, err := zipWriter.Create("NO_LOGS_README.txt")
		if err != nil {
			return fmt.Errorf("failed to create readme in archive: %w", err)
		}
		_, err = fmt.Fprintf(writer,
			"No log files found.\n\nLogs directory: %s\nExport time: %s\n\nLog files will be created when the application runs.\n",
			logsDir,
			time.Now().Format(time.RFC3339),
		)
		if err != nil {
			return fmt.Errorf("failed to write readme: %w", err)
		}
		return nil
	}

	fileCount := 0

	// Walk the logs directory and add all log files
	err = filepath.Walk(logsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories
		if info.IsDir() {
			return nil
		}

		// Only include log files (paddockcontrol*.log and *.gz)
		name := info.Name()
		if !strings.HasPrefix(name, "paddockcontrol") {
			return nil
		}

		fileCount++

		// Get relative path for the archive
		relPath, err := filepath.Rel(logsDir, path)
		if err != nil {
			return err
		}

		// Create file header with preserved modification time
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		header.Name = relPath
		header.Method = zip.Deflate

		// Create the file in the archive
		writer, err := zipWriter.CreateHeader(header)
		if err != nil {
			return err
		}

		// Copy file contents
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()

		_, err = io.Copy(writer, file)
		return err
	})

	if err != nil {
		return fmt.Errorf("failed to add files to archive: %w", err)
	}

	// If no log files were found, add a note
	if fileCount == 0 {
		writer, err := zipWriter.Create("NO_LOGS_README.txt")
		if err != nil {
			return fmt.Errorf("failed to create readme in archive: %w", err)
		}
		_, err = fmt.Fprintf(writer,
			"No log files found in logs directory.\n\nLogs directory: %s\nExport time: %s\n",
			logsDir,
			time.Now().Format(time.RFC3339),
		)
		if err != nil {
			return fmt.Errorf("failed to write readme: %w", err)
		}
	}

	return nil
}

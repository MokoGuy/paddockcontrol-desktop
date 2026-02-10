package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"runtime"

	"paddockcontrol-desktop/internal/logger"
	"paddockcontrol-desktop/internal/models"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ============================================================================
// Update Operations
// ============================================================================

// CheckForUpdate checks GitHub for a newer version (startup, cached for 1h)
func (a *App) CheckForUpdate() (models.UpdateInfo, error) {
	a.mu.RLock()
	svc := a.updateService
	a.mu.RUnlock()

	if svc == nil {
		return models.UpdateInfo{}, fmt.Errorf("update service not available")
	}

	info, err := svc.CheckForUpdate(a.ctx, false)
	if err != nil {
		return models.UpdateInfo{}, err
	}
	return *info, nil
}

// CheckForUpdateManual forces an uncached check (Settings button)
func (a *App) CheckForUpdateManual() (models.UpdateInfo, error) {
	a.mu.RLock()
	svc := a.updateService
	a.mu.RUnlock()

	if svc == nil {
		return models.UpdateInfo{}, fmt.Errorf("update service not available")
	}

	info, err := svc.CheckForUpdate(a.ctx, true)
	if err != nil {
		return models.UpdateInfo{}, err
	}
	return *info, nil
}

// DownloadAndApplyUpdate downloads the latest release and replaces the binary
func (a *App) DownloadAndApplyUpdate() error {
	a.mu.RLock()
	svc := a.updateService
	a.mu.RUnlock()

	if svc == nil {
		return fmt.Errorf("update service not available")
	}

	log := logger.WithComponent("app")

	wailsruntime.EventsEmit(a.ctx, "update:progress", map[string]string{
		"state":   "downloading",
		"message": "Downloading update...",
	})

	if err := svc.ApplyUpdate(a.ctx); err != nil {
		log.Error("update failed", logger.Err(err))
		wailsruntime.EventsEmit(a.ctx, "update:error", err.Error())
		return err
	}

	wailsruntime.EventsEmit(a.ctx, "update:progress", map[string]string{
		"state":   "complete",
		"message": "Update complete. Restart to finish.",
	})

	log.Info("update applied, restart required")
	return nil
}

// RestartApp re-launches the executable and quits the current process
func (a *App) RestartApp() error {
	log := logger.WithComponent("app")

	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}
	log.Info("restarting application", slog.String("path", exePath))

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command(exePath)
	} else {
		cmd = exec.Command(exePath)
	}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start new process: %w", err)
	}

	// Quit the current instance
	wailsruntime.Quit(a.ctx)
	return nil
}

// GetUpdateHistory returns the list of past update records
func (a *App) GetUpdateHistory(limit int) ([]models.UpdateHistoryEntry, error) {
	a.mu.RLock()
	svc := a.updateService
	a.mu.RUnlock()

	if svc == nil {
		return []models.UpdateHistoryEntry{}, nil
	}

	return svc.GetUpdateHistory(a.ctx, limit)
}

// startBackgroundUpdateCheck is called from domReady to check for updates in the background
func (a *App) startBackgroundUpdateCheck(ctx context.Context) {
	go func() {
		if !ProductionMode {
			return
		}

		log := logger.WithComponent("app")
		log.Info("starting background update check")

		a.mu.RLock()
		svc := a.updateService
		a.mu.RUnlock()

		if svc == nil {
			return
		}

		info, err := svc.CheckForUpdate(ctx, false)
		if err != nil {
			log.Error("background update check failed", logger.Err(err))
			return
		}

		if info.UpdateAvailable {
			log.Info("update available",
				slog.String("current", info.CurrentVersion),
				slog.String("latest", info.LatestVersion),
			)
			wailsruntime.EventsEmit(ctx, "update:available", *info)
		}
	}()
}

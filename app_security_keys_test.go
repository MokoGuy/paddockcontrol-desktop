package main

import (
	"testing"

	"paddockcontrol-desktop/internal/models"
)

func passwordKeyID(t *testing.T, app *App) int64 {
	t.Helper()
	rows, err := app.db.Queries().GetSecurityKeysByMethod(app.ctx, models.SecurityKeyMethodPassword)
	if err != nil {
		t.Fatalf("GetSecurityKeysByMethod(password): %v", err)
	}
	if len(rows) == 0 {
		t.Fatal("expected a password security key after setup")
	}
	return rows[0].ID
}

func TestRemoveSecurityKey_PasswordIsUnremovable(t *testing.T) {
	app := setupUnlockedApp(t)
	id := passwordKeyID(t, app)

	if err := app.RemoveSecurityKey(id); err == nil {
		t.Fatal("expected the password method to be unremovable")
	}
	if _, err := app.db.Queries().GetSecurityKeyByID(app.ctx, id); err != nil {
		t.Fatalf("password key should still exist after a refused removal: %v", err)
	}
}

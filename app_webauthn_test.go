package main

import "testing"

// On non-Windows (CI is Linux) the webauthn package is a stub, so these exercise
// the graceful-unavailable paths. On Windows the real flow needs a Hello/security
// key prompt and is validated manually (see spike/winhello-prf, issue #92).

func TestEnrollWebAuthn_FailsWhenUnavailable(t *testing.T) {
	app := setupUnlockedApp(t)
	if app.IsWebAuthnAvailable() {
		t.Skip("platform WebAuthn available (Windows) — skip the unavailable-path test")
	}
	if err := app.EnrollWebAuthn("Passkey"); err == nil {
		t.Fatal("expected EnrollWebAuthn to fail when WebAuthn is unavailable")
	}
}

func TestUnlockWithWebAuthn_FailsWhenLockedAndUnavailable(t *testing.T) {
	app := setupConfiguredApp(t) // configured but locked
	ok, err := app.UnlockWithWebAuthn()
	if ok {
		t.Fatal("expected passkey unlock to fail")
	}
	if err == nil {
		t.Fatal("expected an error (no passkey enrolled / unavailable)")
	}
}

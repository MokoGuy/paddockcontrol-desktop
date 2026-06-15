# Spike: Windows Hello PRF envelope (issue #92)

Validates that the native Windows WebAuthn API — via the CGO-free
[`go-ctap/winhello`](https://github.com/go-ctap/winhello) — can derive a stable
**PRF/hmac-secret** secret from **Windows Hello** and use it to envelope-encrypt
the app's master key. This is the de-risking gate before wiring a `webauthn`
unlock method.

## Build (from WSL/Linux — no CGO, no Windows toolchain)

```bash
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o winhello-prf.exe .
```

## Run (on Windows — shows the Windows Hello prompt)

```text
winhello-prf.exe          # 1st run: creates a Hello credential + tests PRF/envelope
winhello-prf.exe          # 2nd run: re-derives from a fresh process (cross-restart proof)
winhello-prf.exe cleanup  # removes the spike credential + state file
```

## Pass criteria
- `Windows WebAuthn API version` printed; platform authenticator available.
- `PRFEnabled=true` on create (needs Win11 ~25H2+ for the platform authenticator).
- Deterministic 32-byte PRF secret (same credential+salt → identical), salt-dependent.
- Envelope round-trip: master key wrapped with the PRF KEK and recovered.
- 2nd run reuses the credential and re-derives the same secret across processes.

A `[FAIL] ...` line + non-zero exit means the path isn't viable as-is on this machine.

# Spike: Windows passkey PRF envelope (issue #92)

Validates that the native Windows WebAuthn API — via the CGO-free
[`go-ctap/winhello`](https://github.com/go-ctap/winhello) — can derive a stable
**PRF/hmac-secret** secret from a passkey and use it to envelope-encrypt the app's
master key. This is the de-risking gate before wiring the `webauthn` unlock method.

It exercises the **two authenticator paths** the app offers, each with the
residency Windows actually requires:

| Path | `winhello-prf.exe …` | Attachment | Resident |
| --- | --- | --- | --- |
| Windows Hello | *(default)* | platform | **yes** |
| Security key (YubiKey) | `key` | cross-platform | no |

## Build (from WSL/Linux — no CGO, no Windows toolchain)

```bash
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o winhello-prf.exe .
```

## Run (on Windows — shows the authenticator prompt)

```text
winhello-prf.exe          # Windows Hello (platform, resident) — create + test PRF/envelope
winhello-prf.exe          # run again: re-derive from a fresh process (cross-restart proof)
winhello-prf.exe key      # security key (cross-platform, non-resident)
winhello-prf.exe cleanup  # remove the spike's resident credential(s) + state files
```

## Design notes (what the exploration established)

- **The device chooser is `webauthn.dll`'s own UI**, not a `winhello` bug — winhello
  faithfully passes attachment / hints / hmac-secret. Re-implementing the API
  calls ourselves would show the same dialog.
- **Windows Hello requires *resident* credentials for hmac-secret**
  ([libfido2 #731](https://github.com/Yubico/libfido2/discussions/731)). A
  non-resident Hello credential can't satisfy the request, so Windows offers
  roaming authenticators (the phone / security-key chooser). Hence platform =
  resident here.
- **PRF is enabled at create but evaluated at get** — the secret is not returned
  during registration, so we set `bEnablePrf` (not `pPRFGlobalEval`) and derive in
  a separate assertion. The documented two-step pattern
  ([Yubico](https://developers.yubico.com/WebAuthn/Concepts/PRF_Extension/Developers_Guide_to_PRF.html)).

## Pass criteria
- `Windows WebAuthn API version` printed; platform authenticator available.
- `MakeCredential OK` with **no** phone / security-key chooser for the chosen path.
- Deterministic 32-byte PRF secret (same credential+salt → identical).
- Envelope round-trip: master key wrapped with the PRF KEK and recovered.
- 2nd run reuses the credential and re-derives the same secret across processes.

A `[FAIL] …` line + non-zero exit means the path isn't viable as-is on this machine.

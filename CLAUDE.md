# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. See [CONTRIBUTING.md](CONTRIBUTING.md) for full dev setup, commands, CI, and project structure.

## Project Overview

PaddockControl Desktop is a certificate management desktop application built with:
- **Backend**: Go with Wails v2 framework
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui
- **Database**: SQLite with sqlc for type-safe queries
- **State**: Zustand for frontend state management

## Common Commands

```bash
# Development (uses webkit2_41 tag for Ubuntu 24 compatibility)
task dev

# Production build for Windows with version injection
task build

# Clean local data (database and logs) - Linux only
task clean

# Add shadcn/ui components
cd frontend && npx shadcn@latest add [component-name]

# Regenerate sqlc types after modifying SQL
cd internal/db && sqlc generate

# Lint frontend (ESLint)
cd frontend && npm run lint

# Type-check frontend (tsc)
cd frontend && npm run typecheck
```

## Architecture

### Go Backend (`/`)

```
main.go          # Wails app entry point, embeds frontend/dist
app.go           # Main App struct with all exported methods (bound to frontend)
version.go       # Build-time version variables
build_dev.go     # Development mode flag (ProductionMode = false)
build_prod.go    # Production mode flag (ProductionMode = true)
```

The `App` struct in `app.go` is the bridge between Go and frontend. All its public methods are callable from TypeScript via Wails bindings.

### Internal Packages (`/internal/`)

- **config/**: Configuration service and validation
- **crypto/**: RSA key generation, CSR creation, certificate parsing, AES-256-GCM encryption with master key wrapping, Argon2id key derivation
- **keystore/**: OS-native keyring abstraction (Linux via D-Bus, Windows via WinCred)
- **db/**: SQLite database initialization, migrations, sqlc queries
  - `schema.sql`: Source of truth for database schema
  - `queries/`: SQL queries for sqlc code generation
  - `sqlc/`: Generated type-safe Go code (do not edit manually)
  - `status.go`: Certificate status computation (pending/active/expiring/expired)
- **logger/**: Rotating file logger with lumberjack
- **models/**: Go structs shared between services and exposed to frontend
- **services/**: Business logic (CertificateService, AutoBackupService, SetupService)

### Frontend (`/frontend/`)

```
src/
├── App.tsx              # Router and main layout
├── components/
│   ├── ui/             # shadcn/ui primitives
│   ├── animate-ui/     # Animation components (Motion)
│   ├── certificate/    # Certificate-related components
│   ├── layout/         # Header, sidebar, page layout
│   ├── settings/       # Settings page components
│   ├── setup/          # Initial setup wizard
│   └── shared/         # Reusable components
├── hooks/              # Custom React hooks
├── lib/                # Utilities (cn, date formatting)
├── pages/              # Page components
├── stores/             # Zustand stores
├── types/              # TypeScript type re-exports
└── wailsjs/            # Auto-generated Wails bindings (do not edit)
```

### Type Flow

Go structs in `internal/models/` are the source of truth. Wails generates TypeScript bindings in `frontend/wailsjs/go/models.ts`. Frontend re-exports these in `src/types/index.ts` with stricter type aliases for enums.

When modifying Go models, run `wails dev` or `wails build` to regenerate TypeScript bindings.

## UI Conventions

- **Squared design**: Do not use rounded corners (`rounded-*` classes) on UI elements. Keep edges square.

## Key Patterns

### Master Key & Unlock Flow

A random 32-byte master key encrypts all certificate private keys (AES-256-GCM). The master key itself is wrapped by one or more unlock methods stored in the `security_keys` table:
- **Password**: Argon2id derives a wrapping key from the user's password
- **OS-native keyring**: A random wrapping key stored in the OS keyring (Linux D-Bus / Windows WinCred)

The app has two modes:
1. **Locked mode**: Read-only operations (list, view, delete certificates) without master key in memory
2. **Unlocked mode**: All operations including CSR generation, key export (master key in memory)

On startup, the app attempts auto-unlock via OS keyring. If unavailable, the user provides their password.

Methods use guards:
- `requireSetupOnly()`: Setup complete, unlock not required
- `requireUnlocked()`: Master key must be in memory
- `requireSetupComplete()`: Both setup and unlock required

### Backup System

Database backups (SQLite file copies via `VACUUM INTO`) are the single backup format. There is no JSON export/import.

- **Auto-backups**: Created automatically before destructive operations (stored in `backups/` subdirectory)
- **Manual backups**: Created on-demand from Settings
- **Full restore**: Replaces the entire database with a backup file (locks the app, requires password re-entry)
- **Certificate import**: Selectively imports certificates from another backup's database, re-encrypting private keys from the backup's master key to the current master key

Key methods in `app_backup_import.go`:
- `PeekBackupInfo(path)`: Opens backup DB read-only, returns cert count, CA name, hostnames
- `ImportCertificatesFromBackup(path, password)`: Unwraps backup's master key, re-encrypts certs, inserts non-conflicting hostnames
- `RestoreFromBackupFile(path)`: Full DB replacement from any `.db` file

### Certificate Status

Status is computed dynamically in `internal/db/status.go`:
- `pending`: Has CSR but no certificate
- `active`: Has valid certificate (expires > 30 days)
- `expiring`: Certificate expires within 30 days
- `expired`: Certificate has expired

### Database Migrations

Migrations are embedded in `internal/db/migrations/` using go:embed. Schema changes require:
1. Create new migration file (e.g., `003_add_field.up.sql`)
2. Update `schema.sql` to match
3. Run `cd internal/db && sqlc generate`

### Frontend Wails Calls

```typescript
import { GenerateCSR, ListCertificates } from "../wailsjs/go/main/App";

// All App methods are available as async functions
const result = await GenerateCSR(csrRequest);
```

## Data Storage

- **Windows**: `%APPDATA%\PaddockControl\`
- **Linux**: `~/.local/share/paddockcontrol/`

Contains:
- `certificates.db`: SQLite database
- `app.log`: Application logs (rotated)

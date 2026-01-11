# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

# Lint frontend
cd frontend && npm run lint
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
- **crypto/**: RSA key generation, CSR creation, certificate parsing, AES encryption/decryption for private keys
- **db/**: SQLite database initialization, migrations, sqlc queries
  - `schema.sql`: Source of truth for database schema
  - `queries/`: SQL queries for sqlc code generation
  - `sqlc/`: Generated type-safe Go code (do not edit manually)
  - `status.go`: Certificate status computation (pending/active/expiring/expired)
- **logger/**: Rotating file logger with lumberjack
- **models/**: Go structs shared between services and exposed to frontend
- **services/**: Business logic (CertificateService, BackupService, SetupService)

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

## Key Patterns

### Encryption Key Handling

The app has two modes:
1. **Limited mode**: Read-only operations (list, view, delete certificates) without encryption key
2. **Full mode**: All operations including CSR generation, key export (requires encryption key)

Methods use guards:
- `requireSetupOnly()`: Setup complete, key not required
- `requireEncryptionKey()`: Key must be provided
- `requireSetupComplete()`: Both setup and key required

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

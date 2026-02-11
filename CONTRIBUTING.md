# Contributing to PaddockControl Desktop

## Prerequisites

- [Go 1.24+](https://go.dev/dl/)
- [Node.js 20+](https://nodejs.org/)
- [Wails CLI v2.11.0](https://wails.io/docs/gettingstarted/installation) &mdash; `go install github.com/wailsapp/wails/v2/cmd/wails@v2.11.0`
- [Task](https://taskfile.dev/) (task runner)
- **Linux only**: `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`

## Getting Started

```bash
git clone https://github.com/MokoGuy/paddockcontrol-desktop.git
cd paddockcontrol-desktop
cd frontend && npm install && cd ..
task dev
```

## Commands

| Command                                       | Description                                                  |
| --------------------------------------------- | ------------------------------------------------------------ |
| `task dev`                                    | Start dev server (uses `webkit2_41` build tag for Ubuntu 24) |
| `task build`                                  | Production Windows build with version injection              |
| `task clean`                                  | Remove local data &mdash; database and logs (Linux)          |
| `cd frontend && npm run lint`                 | ESLint                                                       |
| `cd frontend && npm run typecheck`            | TypeScript type check                                        |
| `cd internal/db && sqlc generate`             | Regenerate DB types after SQL changes                        |
| `cd frontend && npx shadcn@latest add [name]` | Add a shadcn/ui component                                    |
| `task screenshots`                            | Regenerate README screenshots with synthetic data            |

## Project Structure

```
main.go                  # Wails app entry, embeds frontend/dist
app.go                   # App struct — all exported methods bound to frontend
version.go               # Build-time version variables
build_dev.go / build_prod.go  # ProductionMode flag

internal/
├── config/              # Configuration service and validation
├── crypto/              # RSA keygen, CSR creation, cert parsing, AES encrypt/decrypt
├── db/                  # SQLite init, migrations, sqlc queries
│   ├── schema.sql       # Source of truth for DB schema
│   ├── queries/         # SQL for sqlc code generation
│   ├── sqlc/            # Generated Go code (do not edit)
│   └── status.go        # Certificate status computation
├── logger/              # Rotating file logger (lumberjack)
├── models/              # Shared Go structs exposed to frontend
└── services/            # Business logic (Certificate, Backup, Setup)

frontend/src/
├── App.tsx              # Router and main layout
├── components/
│   ├── ui/              # shadcn/ui primitives
│   ├── animate-ui/      # Animation components (Motion)
│   ├── certificate/     # Certificate-related components
│   ├── layout/          # Header, sidebar, page layout
│   ├── settings/        # Settings page components
│   ├── setup/           # Initial setup wizard
│   └── shared/          # Reusable components
├── hooks/               # Custom React hooks
├── lib/                 # Utilities (cn, date formatting)
├── pages/               # Page components
├── stores/              # Zustand stores
├── types/               # TypeScript type re-exports
└── wailsjs/             # Auto-generated Wails bindings (do not edit)
```

## Architecture Overview

PaddockControl uses the [Wails](https://wails.io/) bridge pattern:

1. The Go `App` struct in `app.go` exposes public methods
2. Wails auto-generates TypeScript bindings in `frontend/wailsjs/go/`
3. The frontend imports these bindings as async functions
4. Go models in `internal/models/` are the source of truth for types

When modifying Go models or `App` methods, run `wails dev` or `wails build` to regenerate TypeScript bindings.

## Coding Conventions

- **Squared UI design** &mdash; do not use `rounded-*` Tailwind classes. Keep edges square.
- **sqlc** for all database queries &mdash; write SQL in `internal/db/queries/`, run `sqlc generate`
- **Zustand** for frontend state management
- **Zod** for form validation

## Database Changes

1. Create a new migration file in `internal/db/migrations/` (e.g. `003_add_field.up.sql`)
2. Update `internal/db/schema.sql` to match
3. Run `cd internal/db && sqlc generate`

## CI/CD

### CI (`ci.yml`)

Runs on push to `main` and on pull requests (skips `release-please--` branches):

1. **Go tests** with race detection &mdash; `go test -v -race ./internal/...`
2. **Frontend lint** (ESLint)
3. **Frontend typecheck** (tsc)

### Release (`release-please.yml`)

- [Release Please](https://github.com/googleapis/release-please) auto-creates version bump PRs from conventional commits
- On release: builds a Windows amd64 `.exe` with ldflags version injection and uploads it to the GitHub release
- Config files: `release-please-config.json`, `.release-please-manifest.json`

## Testing

```bash
# Go unit tests
go test -v -race ./internal/...

# E2E tests (headless)
task test:e2e

# E2E tests with interactive UI
task test:e2e:ui

# E2E tests with visible browser (slow motion)
task test:e2e:headed
```

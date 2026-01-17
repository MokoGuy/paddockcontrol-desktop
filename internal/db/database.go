package db

import (
	"database/sql"
	"embed"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"paddockcontrol-desktop/internal/db/sqlc"
	"paddockcontrol-desktop/internal/logger"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Database wraps the SQL database connection and provides query methods
type Database struct {
	db      *sql.DB
	queries *sqlc.Queries
}

// NewDatabase initializes a new database connection and runs migrations
func NewDatabase(dataDir string) (*Database, error) {
	log := logger.WithComponent("database")
	log.Info("initializing database", slog.String("data_dir", dataDir))

	var dbPath string

	// Check if in-memory mode is requested (for testing)
	if dataDir == ":memory:" {
		// Use shared memory mode so migrations persist across connections
		// WAL mode doesn't apply to in-memory databases
		dbPath = "file::memory:?cache=shared"
		log.Debug("using in-memory database")
	} else {
		// Ensure data directory exists
		if err := ensureDir(dataDir); err != nil {
			log.Error("failed to create data directory", logger.Err(err))
			return nil, fmt.Errorf("failed to create data directory: %w", err)
		}
		// Construct database path with WAL mode for file-based databases
		dbPath = filepath.Join(dataDir, "certificates.db") + "?_journal_mode=WAL"
		log.Debug("database path", slog.String("path", dbPath))
	}

	// Open database
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Error("failed to open database", logger.Err(err))
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		log.Error("failed to connect to database", logger.Err(err))
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	log.Debug("database connection established")

	// Run migrations
	log.Info("running database migrations")
	if err := runMigrations(db); err != nil {
		db.Close()
		log.Error("failed to run migrations", logger.Err(err))
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}
	log.Info("database migrations completed successfully")

	return &Database{
		db:      db,
		queries: sqlc.New(db),
	}, nil
}

// runMigrations executes all pending database migrations
func runMigrations(db *sql.DB) error {
	log := logger.WithComponent("database")

	driver, err := sqlite3.WithInstance(db, &sqlite3.Config{})
	if err != nil {
		log.Error("failed to create migration driver", logger.Err(err))
		return fmt.Errorf("failed to create migration driver: %w", err)
	}

	source, err := iofs.New(migrations, "migrations")
	if err != nil {
		log.Error("failed to create migration source", logger.Err(err))
		return fmt.Errorf("failed to create migration source: %w", err)
	}

	m, err := migrate.NewWithInstance("iofs", source, "sqlite3", driver)
	if err != nil {
		log.Error("failed to create migrator", logger.Err(err))
		return fmt.Errorf("failed to create migrator: %w", err)
	}

	// Run all pending migrations
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Error("migration failed", logger.Err(err))
		return fmt.Errorf("migration failed: %w", err)
	}

	if err == migrate.ErrNoChange {
		log.Debug("no migrations to run")
	}

	return nil
}

// ResetWithMigrations drops all tables and re-runs migrations (for testing)
func (d *Database) ResetWithMigrations() error {
	log := logger.WithComponent("database")
	log.Info("resetting database with migrations")

	driver, err := sqlite3.WithInstance(d.db, &sqlite3.Config{})
	if err != nil {
		log.Error("failed to create migration driver", logger.Err(err))
		return fmt.Errorf("failed to create migration driver: %w", err)
	}

	source, err := iofs.New(migrations, "migrations")
	if err != nil {
		log.Error("failed to create migration source", logger.Err(err))
		return fmt.Errorf("failed to create migration source: %w", err)
	}

	m, err := migrate.NewWithInstance("iofs", source, "sqlite3", driver)
	if err != nil {
		log.Error("failed to create migrator", logger.Err(err))
		return fmt.Errorf("failed to create migrator: %w", err)
	}

	// Drop all tables (run down migration)
	log.Debug("running down migrations")
	if err := m.Down(); err != nil && err != migrate.ErrNoChange {
		log.Error("down migration failed", logger.Err(err))
		return fmt.Errorf("down migration failed: %w", err)
	}

	// Recreate all tables (run up migration)
	log.Debug("running up migrations")
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Error("up migration failed", logger.Err(err))
		return fmt.Errorf("up migration failed: %w", err)
	}

	log.Info("database reset completed successfully")
	return nil
}

// Close closes the database connection
func (d *Database) Close() error {
	log := logger.WithComponent("database")
	if d.db != nil {
		log.Debug("closing database connection")
		return d.db.Close()
	}
	return nil
}

// DB returns the underlying sql.DB connection
func (d *Database) DB() *sql.DB {
	return d.db
}

// Queries returns the SQLC queries
func (d *Database) Queries() *sqlc.Queries {
	return d.queries
}

// GetDB returns the underlying database connection for transaction support
func (d *Database) GetDB() *sql.DB {
	return d.db
}

// ensureDir ensures a directory exists, creating it if necessary
func ensureDir(path string) error {
	return os.MkdirAll(path, 0700)
}

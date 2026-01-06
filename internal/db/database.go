package db

import (
	"database/sql"
	"embed"
	"fmt"
	"os"
	"path/filepath"

	"paddockcontrol-desktop/internal/db/sqlc"

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
	// Ensure data directory exists
	if err := ensureDir(dataDir); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	// Construct database path
	dbPath := filepath.Join(dataDir, "certificates.db")

	// Open database with WAL mode enabled
	db, err := sql.Open("sqlite", dbPath+"?_journal_mode=WAL")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Run migrations
	if err := runMigrations(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return &Database{
		db:      db,
		queries: sqlc.New(db),
	}, nil
}

// runMigrations executes all pending database migrations
func runMigrations(db *sql.DB) error {
	driver, err := sqlite3.WithInstance(db, &sqlite3.Config{})
	if err != nil {
		return fmt.Errorf("failed to create migration driver: %w", err)
	}

	source, err := iofs.New(migrations, "migrations")
	if err != nil {
		return fmt.Errorf("failed to create migration source: %w", err)
	}

	m, err := migrate.NewWithInstance("iofs", source, "sqlite3", driver)
	if err != nil {
		return fmt.Errorf("failed to create migrator: %w", err)
	}

	// Run all pending migrations
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("migration failed: %w", err)
	}

	return nil
}

// Close closes the database connection
func (d *Database) Close() error {
	if d.db != nil {
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

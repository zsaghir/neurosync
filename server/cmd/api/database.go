package main

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultDatabaseMaxConnections = int32(10)
	defaultDatabaseMinConnections = int32(1)
	defaultDatabaseMaxLifetime    = 30 * time.Minute
	defaultDatabaseMaxIdleTime    = 5 * time.Minute
	defaultDatabaseStartupTimeout = 10 * time.Second
	defaultDatabaseReadyTimeout   = 2 * time.Second
)

// Database contains the PostgreSQL behavior used by HTTP handlers.
// pgxpool.Pool satisfies this interface.
type Database interface {
	Ping(context.Context) error
	QueryRow(context.Context, string, ...any) pgx.Row
}

var _ Database = (*pgxpool.Pool)(nil)

// DatabaseConfig contains server-only PostgreSQL connection settings.
type DatabaseConfig struct {
	URL               string
	MaxConnections    int32
	MinConnections    int32
	MaxConnectionLife time.Duration
	MaxConnectionIdle time.Duration
	StartupTimeout    time.Duration
	ReadinessTimeout  time.Duration
}

// loadDatabaseConfig reads database settings without logging their values.
func loadDatabaseConfig(getenv func(string) string) (DatabaseConfig, error) {
	databaseURL := strings.TrimSpace(getenv("DATABASE_URL"))
	if databaseURL == "" {
		return DatabaseConfig{}, errors.New("DATABASE_URL is required")
	}

	maxConnections, err := int32EnvironmentSetting(
		getenv,
		"DB_MAX_CONNS",
		defaultDatabaseMaxConnections,
	)
	if err != nil {
		return DatabaseConfig{}, err
	}

	minConnections, err := int32EnvironmentSetting(
		getenv,
		"DB_MIN_CONNS",
		defaultDatabaseMinConnections,
	)
	if err != nil {
		return DatabaseConfig{}, err
	}

	maxLifetime, err := durationEnvironmentSetting(
		getenv,
		"DB_MAX_CONN_LIFETIME",
		defaultDatabaseMaxLifetime,
	)
	if err != nil {
		return DatabaseConfig{}, err
	}

	maxIdleTime, err := durationEnvironmentSetting(
		getenv,
		"DB_MAX_CONN_IDLE_TIME",
		defaultDatabaseMaxIdleTime,
	)
	if err != nil {
		return DatabaseConfig{}, err
	}

	startupTimeout, err := durationEnvironmentSetting(
		getenv,
		"DB_STARTUP_TIMEOUT",
		defaultDatabaseStartupTimeout,
	)
	if err != nil {
		return DatabaseConfig{}, err
	}

	readinessTimeout, err := durationEnvironmentSetting(
		getenv,
		"DB_READINESS_TIMEOUT",
		defaultDatabaseReadyTimeout,
	)
	if err != nil {
		return DatabaseConfig{}, err
	}

	if maxConnections <= 0 {
		return DatabaseConfig{}, errors.New("DB_MAX_CONNS must be greater than zero")
	}
	if minConnections < 0 {
		return DatabaseConfig{}, errors.New("DB_MIN_CONNS cannot be negative")
	}
	if minConnections > maxConnections {
		return DatabaseConfig{}, errors.New("DB_MIN_CONNS cannot exceed DB_MAX_CONNS")
	}

	return DatabaseConfig{
		URL:               databaseURL,
		MaxConnections:    maxConnections,
		MinConnections:    minConnections,
		MaxConnectionLife: maxLifetime,
		MaxConnectionIdle: maxIdleTime,
		StartupTimeout:    startupTimeout,
		ReadinessTimeout:  readinessTimeout,
	}, nil
}

func int32EnvironmentSetting(
	getenv func(string) string,
	name string,
	fallback int32,
) (int32, error) {
	rawValue := strings.TrimSpace(getenv(name))
	if rawValue == "" {
		return fallback, nil
	}

	value, err := strconv.ParseInt(rawValue, 10, 32)
	if err != nil {
		return 0, fmt.Errorf("%s must be a whole number", name)
	}

	return int32(value), nil
}

func durationEnvironmentSetting(
	getenv func(string) string,
	name string,
	fallback time.Duration,
) (time.Duration, error) {
	rawValue := strings.TrimSpace(getenv(name))
	if rawValue == "" {
		return fallback, nil
	}

	value, err := time.ParseDuration(rawValue)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("%s must be a positive duration", name)
	}

	return value, nil
}

func newDatabasePool(
	ctx context.Context,
	config DatabaseConfig,
) (*pgxpool.Pool, error) {
	poolConfig, err := pgxpool.ParseConfig(config.URL)
	if err != nil {
		return nil, errors.New("database connection configuration is invalid")
	}

	poolConfig.MaxConns = config.MaxConnections
	poolConfig.MinConns = config.MinConnections
	poolConfig.MaxConnLifetime = config.MaxConnectionLife
	poolConfig.MaxConnIdleTime = config.MaxConnectionIdle

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, errors.New("database pool could not be created")
	}

	return pool, nil
}

func connectDatabase(
	ctx context.Context,
	config DatabaseConfig,
) (*pgxpool.Pool, error) {
	startupContext, cancel := context.WithTimeout(ctx, config.StartupTimeout)
	defer cancel()

	pool, err := newDatabasePool(startupContext, config)
	if err != nil {
		return nil, err
	}

	if err := pool.Ping(startupContext); err != nil {
		pool.Close()
		return nil, errors.New("database startup check failed")
	}

	return pool, nil
}

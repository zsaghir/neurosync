package main

import (
	"context"
	"testing"
	"time"
)

func TestLoadDatabaseConfigRequiresDatabaseURL(t *testing.T) {
	_, err := loadDatabaseConfig(func(string) string {
		return ""
	})

	if err == nil {
		t.Fatal("expected missing DATABASE_URL to return an error")
	}
}

func TestLoadDatabaseConfigUsesConservativeDefaults(t *testing.T) {
	config, err := loadDatabaseConfig(func(name string) string {
		if name == "DATABASE_URL" {
			return "postgresql://example.test/neurosync"
		}
		return ""
	})
	if err != nil {
		t.Fatalf("expected valid configuration, got %v", err)
	}

	if config.MaxConnections != defaultDatabaseMaxConnections {
		t.Errorf(
			"expected max connections %d, got %d",
			defaultDatabaseMaxConnections,
			config.MaxConnections,
		)
	}
	if config.MinConnections != defaultDatabaseMinConnections {
		t.Errorf(
			"expected min connections %d, got %d",
			defaultDatabaseMinConnections,
			config.MinConnections,
		)
	}
	if config.MaxConnectionLife != defaultDatabaseMaxLifetime {
		t.Errorf(
			"expected max lifetime %s, got %s",
			defaultDatabaseMaxLifetime,
			config.MaxConnectionLife,
		)
	}
	if config.MaxConnectionIdle != defaultDatabaseMaxIdleTime {
		t.Errorf(
			"expected max idle time %s, got %s",
			defaultDatabaseMaxIdleTime,
			config.MaxConnectionIdle,
		)
	}
	if config.StartupTimeout != defaultDatabaseStartupTimeout {
		t.Errorf(
			"expected startup timeout %s, got %s",
			defaultDatabaseStartupTimeout,
			config.StartupTimeout,
		)
	}
	if config.ReadinessTimeout != defaultDatabaseReadyTimeout {
		t.Errorf(
			"expected readiness timeout %s, got %s",
			defaultDatabaseReadyTimeout,
			config.ReadinessTimeout,
		)
	}
}

func TestLoadDatabaseConfigReadsOverrides(t *testing.T) {
	environment := map[string]string{
		"DATABASE_URL":          "postgresql://example.test/neurosync",
		"DB_MAX_CONNS":          "6",
		"DB_MIN_CONNS":          "2",
		"DB_MAX_CONN_LIFETIME":  "20m",
		"DB_MAX_CONN_IDLE_TIME": "3m",
		"DB_STARTUP_TIMEOUT":    "8s",
		"DB_READINESS_TIMEOUT":  "1500ms",
	}

	config, err := loadDatabaseConfig(func(name string) string {
		return environment[name]
	})
	if err != nil {
		t.Fatalf("expected valid configuration, got %v", err)
	}

	if config.MaxConnections != 6 {
		t.Errorf("expected max connections 6, got %d", config.MaxConnections)
	}
	if config.MinConnections != 2 {
		t.Errorf("expected min connections 2, got %d", config.MinConnections)
	}
	if config.MaxConnectionLife != 20*time.Minute {
		t.Errorf("expected max lifetime 20m, got %s", config.MaxConnectionLife)
	}
	if config.MaxConnectionIdle != 3*time.Minute {
		t.Errorf("expected max idle time 3m, got %s", config.MaxConnectionIdle)
	}
	if config.StartupTimeout != 8*time.Second {
		t.Errorf("expected startup timeout 8s, got %s", config.StartupTimeout)
	}
	if config.ReadinessTimeout != 1500*time.Millisecond {
		t.Errorf(
			"expected readiness timeout 1500ms, got %s",
			config.ReadinessTimeout,
		)
	}
}

func TestNewDatabasePoolRejectsInvalidConnectionConfiguration(t *testing.T) {
	config := DatabaseConfig{
		URL:               "://not-a-postgresql-url",
		MaxConnections:    defaultDatabaseMaxConnections,
		MinConnections:    defaultDatabaseMinConnections,
		MaxConnectionLife: defaultDatabaseMaxLifetime,
		MaxConnectionIdle: defaultDatabaseMaxIdleTime,
		StartupTimeout:    defaultDatabaseStartupTimeout,
		ReadinessTimeout:  defaultDatabaseReadyTimeout,
	}

	pool, err := newDatabasePool(context.Background(), config)
	if pool != nil {
		pool.Close()
	}

	if err == nil {
		t.Fatal("expected invalid database connection configuration to fail")
	}
}

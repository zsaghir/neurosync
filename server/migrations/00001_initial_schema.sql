-- +goose Up

-- This table connects a person authenticated by Clerk to NeuroSync's own data.
-- PostgreSQL generates the internal UUID; Clerk supplies clerk_user_id.
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A user can have exactly one settings row.
-- user_id is both the primary key and a foreign key, so a second settings row
-- for the same user is impossible.
CREATE TABLE user_settings (
    user_id UUID PRIMARY KEY
        REFERENCES users(id)
        ON DELETE CASCADE,
    preferred_time_estimation_mode TEXT NOT NULL DEFAULT 'relative'
        CHECK (preferred_time_estimation_mode IN ('relative', 'minutes', 'custom')),
    theme_mode TEXT NOT NULL DEFAULT 'dark'
        CHECK (theme_mode IN ('dark', 'light')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Tasks
-- ============================================================================
-- A task belongs to one user, while one user can own many tasks.
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (TRIM(title) <> ''),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    time_spent_seconds INTEGER NOT NULL DEFAULT 0
        CHECK (time_spent_seconds >= 0),
    estimated_minutes INTEGER
        CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0),
    notes TEXT,
    alarm_at TIMESTAMPTZ,
    notification_id TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Subtasks
-- ============================================================================
-- Sanity embedded subtasks inside each task. In PostgreSQL, give each subtask
-- its own row so it can be added, toggled, deleted, and ordered independently.
CREATE TABLE subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (TRIM(title) <> ''),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    position INTEGER NOT NULL DEFAULT 0
        CHECK (position >= 0)
);

-- ============================================================================
-- Task sessions
-- ============================================================================
-- A task session is historical evidence of time spent. It belongs to a user
-- and normally points to a task, but it should survive if that task is deleted.
CREATE TABLE task_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    task_id UUID
        REFERENCES tasks(id)
        ON DELETE SET NULL,

    task_title TEXT NOT NULL CHECK (TRIM(task_title) <> ''),

    task_title_signature TEXT NOT NULL
        CHECK (TRIM(task_title_signature) <> ''),

    estimated_minutes INTEGER
        CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0),

    estimate_input_type TEXT NOT NULL
        CHECK (estimate_input_type IN ('bucket', 'preset', 'custom', 'skipped')),

    timer_measured_seconds INTEGER NOT NULL
        CHECK (timer_measured_seconds >= 0),

    actual_seconds INTEGER NOT NULL
        CHECK (actual_seconds >= 0),

    actual_seconds_source TEXT NOT NULL
        CHECK (actual_seconds_source IN ('timer', 'userEdited', 'manual')),

    started_at TIMESTAMPTZ,

    ended_at TIMESTAMPTZ NOT NULL,

    excluded_from_insights BOOLEAN NOT NULL DEFAULT FALSE,
    exclude_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (started_at IS NULL OR ended_at >= started_at),
    CHECK (excluded_from_insights OR exclude_reason IS NULL)
);

-- After completing the three tables, add indexes for the queries your app uses:
--   * tasks by user, newest first
--   * subtasks by task and position
--   * task sessions by user, newest ending first
CREATE INDEX tasks_user_id_created_at_idx
    ON tasks(user_id, created_at DESC);

CREATE INDEX subtasks_task_id_position_idx
    ON subtasks(task_id, position);

CREATE INDEX task_sessions_user_id_ended_at_idx
    ON task_sessions(user_id, ended_at DESC);

-- +goose Down

-- Drop tables in reverse dependency order:
--   1. task_sessions
--   2. subtasks
--   3. tasks
DROP TABLE task_sessions;
DROP TABLE subtasks;
DROP TABLE tasks;
DROP TABLE user_settings;
DROP TABLE users;

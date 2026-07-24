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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- LEARNING TODO 1: Create the tasks table
-- ============================================================================
-- A task belongs to one user, while one user can own many tasks.
   
-- Work out columns for these values from sanity/schemaTypes/task.tsx:
--   * an automatically generated UUID primary key
--   * the owning user's UUID foreign key
--   * title
--   * completed 
--   * time spent in seconds 
--   * estimated minutes  
--   * notes
--   * alarm time
--   * notification ID
--   * completed time
-- Questions to answer while writing it:
--   1. Which columns must always have a value and therefore need NOT NULL?
--   2. Which values should receive a DEFAULT?
--   3. Which integer values must never be negative and therefore need CHECK?
--   4. What should happen to tasks when their user is deleted?
--
-- Write CREATE TABLE tasks (...) below this comment.
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
-- LEARNING TODO 2: Create the subtasks table
-- ============================================================================
-- Sanity embedded subtasks inside each task. In PostgreSQL, give each subtask
-- its own row so it can be added, toggled, deleted, and ordered independently.
--
-- Work out columns for:
--   * an automatically generated UUID primary key
--   * the parent task's UUID foreign key
--   * title
--   * completed
--   * position
--
-- Questions to answer:
--   1. What data type must task_id use if tasks.id is UUID?
--   2. Should a subtask be allowed to exist without a task?
--   3. What should happen to subtasks when their task is deleted?
--   4. Should position be allowed to be negative?
--   5. Do you currently need created_at or updated_at for subtasks?
--
-- Write CREATE TABLE subtasks (...) below this comment.
create table subtasks(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (TRIM(title) <> ''),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    position INTEGER NOT NULL DEFAULT 0
    CHECK (position >= 0)
);
-- ============================================================================
-- LEARNING TODO 3: Create the task_sessions table
-- ============================================================================
-- A task session is historical evidence of time spent. It belongs to a user
-- and normally points to a task, but it should survive if that task is deleted.
--
-- Work out columns from sanity/schemaTypes/taskSession.tsx:
--   * an automatically generated UUID primary key
--   * user UUID foreign key
--   * nullable task UUID foreign key
--   * task title snapshot
--   * task title signature
--   * estimated minutes
--   * estimate input type
--   * timer-measured seconds
--   * actual seconds
--   * source of actual seconds
--   * start and end times
--   * excluded-from-insights flag and reason
--   * created and updated times, if you decide they provide useful history
--
-- Questions to answer:
--   1. Why should task_id use ON DELETE SET NULL instead of CASCADE?
--   2. Which string fields have a fixed set of allowed values and need CHECK?
--   3. Which time values describe the focus session itself?
--   4. Which timestamps only describe the database record?
--
-- Write CREATE TABLE task_sessions (...) below this comment.
CREATE TABLE task_sessions(
   
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    task_id UUID
        REFERENCES tasks(id)
        ON DELETE SET NULL,

    task_title TEXT NOT NULL CHECK (TRIM(task_title) <> ''),

    estimated_minutes INTEGER
        CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0),

    actual_seconds INTEGER NOT NULL
        CHECK (actual_seconds >= 0),

    started_at TIMESTAMPTZ,

    ended_at TIMESTAMPTZ NOT NULL
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

-- When the TODO tables exist, drop them here in reverse dependency order:
--   1. task_sessions
--   2. subtasks
--   3. tasks
DROP TABLE task_sessions;
DROP TABLE subtasks;
DROP TABLE tasks;
DROP TABLE user_settings;
DROP TABLE users;

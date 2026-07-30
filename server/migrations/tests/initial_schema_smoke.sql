\set ON_ERROR_STOP on

BEGIN;

-- Run a statement and fail the smoke test unless it raises the expected
-- PostgreSQL SQLSTATE. The helper lives in pg_temp and disappears with the
-- database session.
CREATE FUNCTION pg_temp.expect_sqlstate(
    statement TEXT,
    expected_state TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    BEGIN
        EXECUTE statement;
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLSTATE = expected_state THEN
                RETURN;
            END IF;

            RAISE;
    END;

    RAISE EXCEPTION
        'expected SQLSTATE %, but the statement succeeded: %',
        expected_state,
        statement;
END;
$$;

CREATE FUNCTION pg_temp.assert_true(
    condition BOOLEAN,
    failure_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF condition IS NOT TRUE THEN
        RAISE EXCEPTION '%', failure_message;
    END IF;
END;
$$;

INSERT INTO users (clerk_user_id)
VALUES ('smoke-primary-user');

INSERT INTO user_settings (user_id)
SELECT id
FROM users
WHERE clerk_user_id = 'smoke-primary-user';

INSERT INTO tasks (user_id, title)
SELECT id, 'Smoke task'
FROM users
WHERE clerk_user_id = 'smoke-primary-user';

INSERT INTO subtasks (task_id, title, position)
SELECT id, 'Smoke subtask', 0
FROM tasks
WHERE title = 'Smoke task';

INSERT INTO task_sessions (
    user_id,
    task_id,
    task_title,
    task_title_signature,
    estimated_minutes,
    estimate_input_type,
    timer_measured_seconds,
    actual_seconds,
    actual_seconds_source,
    started_at,
    ended_at
)
SELECT
    tasks.user_id,
    tasks.id,
    tasks.title,
    'smoke task',
    15,
    'preset',
    900,
    900,
    'timer',
    '2026-01-01 12:00:00+00',
    '2026-01-01 12:15:00+00'
FROM tasks
WHERE tasks.title = 'Smoke task';

SELECT pg_temp.assert_true(
    (
        SELECT
            created_at IS NOT NULL
            AND updated_at IS NOT NULL
            AND preferred_time_estimation_mode = 'relative'
            AND theme_mode = 'dark'
        FROM user_settings
        WHERE user_id = (
            SELECT id
            FROM users
            WHERE clerk_user_id = 'smoke-primary-user'
        )
    ),
    'user_settings defaults were not applied'
);

SELECT pg_temp.assert_true(
    (
        SELECT
            completed = FALSE
            AND time_spent_seconds = 0
            AND created_at IS NOT NULL
        FROM tasks
        WHERE title = 'Smoke task'
    ),
    'task defaults were not applied'
);

SELECT pg_temp.assert_true(
    (
        SELECT
            excluded_from_insights = FALSE
            AND exclude_reason IS NULL
            AND created_at IS NOT NULL
            AND updated_at IS NOT NULL
        FROM task_sessions
        WHERE task_title = 'Smoke task'
    ),
    'task session defaults were not applied'
);

SELECT pg_temp.assert_true(
    (
        SELECT COUNT(*) = 3
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN (
              'tasks_user_id_created_at_idx',
              'subtasks_task_id_position_idx',
              'task_sessions_user_id_ended_at_idx'
          )
    ),
    'one or more required query indexes are missing'
);

-- Unique and one-to-one constraints.
SELECT pg_temp.expect_sqlstate(
    $sql$
        INSERT INTO users (clerk_user_id)
        VALUES ('smoke-primary-user')
    $sql$,
    '23505'
);

SELECT pg_temp.expect_sqlstate(
    $sql$
        INSERT INTO user_settings (user_id)
        SELECT id
        FROM users
        WHERE clerk_user_id = 'smoke-primary-user'
    $sql$,
    '23505'
);

-- Required relationships and non-empty titles.
SELECT pg_temp.expect_sqlstate(
    $sql$
        INSERT INTO tasks (user_id, title)
        SELECT id, '   '
        FROM users
        WHERE clerk_user_id = 'smoke-primary-user'
    $sql$,
    '23514'
);

SELECT pg_temp.expect_sqlstate(
    $sql$
        INSERT INTO subtasks (task_id, title)
        VALUES (
            '00000000-0000-0000-0000-000000000001',
            'Missing parent'
        )
    $sql$,
    '23503'
);

SELECT pg_temp.expect_sqlstate(
    $sql$
        INSERT INTO subtasks (task_id, title)
        SELECT id, '   '
        FROM tasks
        WHERE title = 'Smoke task'
    $sql$,
    '23514'
);

-- Non-negative task values and settings choices.
SELECT pg_temp.expect_sqlstate(
    $sql$
        INSERT INTO tasks (user_id, title, time_spent_seconds)
        SELECT id, 'Negative time', -1
        FROM users
        WHERE clerk_user_id = 'smoke-primary-user'
    $sql$,
    '23514'
);

SELECT pg_temp.expect_sqlstate(
    $sql$
        UPDATE user_settings
        SET theme_mode = 'system'
        WHERE user_id = (
            SELECT id
            FROM users
            WHERE clerk_user_id = 'smoke-primary-user'
        )
    $sql$,
    '23514'
);

-- Session choice, duration, and timestamp constraints.
SELECT pg_temp.expect_sqlstate(
    $sql$
        INSERT INTO task_sessions (
            user_id,
            task_title,
            task_title_signature,
            estimate_input_type,
            timer_measured_seconds,
            actual_seconds,
            actual_seconds_source,
            ended_at
        )
        SELECT
            id,
            'Blank signature',
            '   ',
            'skipped',
            0,
            0,
            'manual',
            NOW()
        FROM users
        WHERE clerk_user_id = 'smoke-primary-user'
    $sql$,
    '23514'
);

SELECT pg_temp.expect_sqlstate(
    $sql$
        INSERT INTO task_sessions (
            user_id,
            task_title,
            task_title_signature,
            estimated_minutes,
            estimate_input_type,
            timer_measured_seconds,
            actual_seconds,
            actual_seconds_source,
            ended_at
        )
        SELECT
            id,
            'Negative estimate',
            'negative estimate',
            -1,
            'custom',
            0,
            0,
            'manual',
            NOW()
        FROM users
        WHERE clerk_user_id = 'smoke-primary-user'
    $sql$,
    '23514'
);

SELECT pg_temp.expect_sqlstate(
    $sql$
        INSERT INTO task_sessions (
            user_id,
            task_title,
            task_title_signature,
            estimate_input_type,
            timer_measured_seconds,
            actual_seconds,
            actual_seconds_source,
            ended_at
        )
        SELECT
            id,
            'Invalid estimate type',
            'invalid estimate type',
            'guess',
            0,
            0,
            'manual',
            NOW()
        FROM users
        WHERE clerk_user_id = 'smoke-primary-user'
    $sql$,
    '23514'
);

SELECT pg_temp.expect_sqlstate(
    $sql$
        INSERT INTO task_sessions (
            user_id,
            task_title,
            task_title_signature,
            estimate_input_type,
            timer_measured_seconds,
            actual_seconds,
            actual_seconds_source,
            ended_at
        )
        SELECT
            id,
            'Negative timer',
            'negative timer',
            'skipped',
            -1,
            0,
            'manual',
            NOW()
        FROM users
        WHERE clerk_user_id = 'smoke-primary-user'
    $sql$,
    '23514'
);

SELECT pg_temp.expect_sqlstate(
    $sql$
        INSERT INTO task_sessions (
            user_id,
            task_title,
            task_title_signature,
            estimate_input_type,
            timer_measured_seconds,
            actual_seconds,
            actual_seconds_source,
            ended_at
        )
        SELECT
            id,
            'Negative actual time',
            'negative actual time',
            'skipped',
            0,
            -1,
            'manual',
            NOW()
        FROM users
        WHERE clerk_user_id = 'smoke-primary-user'
    $sql$,
    '23514'
);

SELECT pg_temp.expect_sqlstate(
    $sql$
        INSERT INTO task_sessions (
            user_id,
            task_title,
            task_title_signature,
            estimate_input_type,
            timer_measured_seconds,
            actual_seconds,
            actual_seconds_source,
            ended_at
        )
        SELECT
            id,
            'Invalid source',
            'invalid source',
            'custom',
            0,
            0,
            'corrected',
            NOW()
        FROM users
        WHERE clerk_user_id = 'smoke-primary-user'
    $sql$,
    '23514'
);

SELECT pg_temp.expect_sqlstate(
    $sql$
        INSERT INTO task_sessions (
            user_id,
            task_title,
            task_title_signature,
            estimate_input_type,
            timer_measured_seconds,
            actual_seconds,
            actual_seconds_source,
            started_at,
            ended_at
        )
        SELECT
            id,
            'Backwards session',
            'backwards session',
            'bucket',
            60,
            60,
            'timer',
            '2026-01-01 12:01:00+00',
            '2026-01-01 12:00:00+00'
        FROM users
        WHERE clerk_user_id = 'smoke-primary-user'
    $sql$,
    '23514'
);

SELECT pg_temp.expect_sqlstate(
    $sql$
        INSERT INTO task_sessions (
            user_id,
            task_title,
            task_title_signature,
            estimate_input_type,
            timer_measured_seconds,
            actual_seconds,
            actual_seconds_source,
            ended_at,
            excluded_from_insights,
            exclude_reason
        )
        SELECT
            id,
            'Unexpected exclusion reason',
            'unexpected exclusion reason',
            'skipped',
            0,
            60,
            'manual',
            NOW(),
            FALSE,
            'should be null'
        FROM users
        WHERE clerk_user_id = 'smoke-primary-user'
    $sql$,
    '23514'
);

-- A task deletion removes embedded child rows but preserves session history.
DELETE FROM tasks
WHERE title = 'Smoke task';

SELECT pg_temp.assert_true(
    (SELECT COUNT(*) = 0 FROM subtasks),
    'deleting a task did not cascade to its subtasks'
);

SELECT pg_temp.assert_true(
    (
        SELECT COUNT(*) = 1
        FROM task_sessions
        WHERE task_title = 'Smoke task'
          AND task_id IS NULL
    ),
    'deleting a task did not preserve its session with a null task_id'
);

-- Deleting the user removes the settings and remaining historical sessions.
DELETE FROM users
WHERE clerk_user_id = 'smoke-primary-user';

SELECT pg_temp.assert_true(
    (SELECT COUNT(*) = 0 FROM user_settings),
    'deleting a user did not cascade to settings'
);

SELECT pg_temp.assert_true(
    (SELECT COUNT(*) = 0 FROM task_sessions),
    'deleting a user did not cascade to task sessions'
);

ROLLBACK;

\echo 'initial schema smoke tests passed'

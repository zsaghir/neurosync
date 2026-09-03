-- +goose Up

-- A check-in records what is blocking a user and which support action they try.
-- It may be linked to a task, but users can also check in before choosing one.
CREATE TABLE check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    task_id UUID
        REFERENCES tasks(id)
        ON DELETE SET NULL,

    blocker TEXT NOT NULL
        CHECK (
            blocker IN (
                'shame',
                'task_initiation',
                'time_blindness'
            )
        ),

    reason TEXT
        CHECK (
            reason IS NULL
            OR (
                TRIM(reason) <> ''
                AND CHAR_LENGTH(reason) <= 64
            )
        ),

    support_action TEXT
        CHECK (
            support_action IS NULL
            OR (
                TRIM(support_action) <> ''
                AND CHAR_LENGTH(support_action) <= 64
            )
        ),

    next_step TEXT
        CHECK (
            next_step IS NULL
            OR (
                TRIM(next_step) <> ''
                AND CHAR_LENGTH(next_step) <= 280
            )
        ),

    planned_minutes INTEGER
        CHECK (
            planned_minutes IS NULL
            OR planned_minutes BETWEEN 1 AND 1440
        ),

    helpfulness TEXT
        CHECK (
            helpfulness IS NULL
            OR helpfulness IN ('yes', 'a_little', 'not_yet')
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX check_ins_user_id_created_at_idx
    ON check_ins(user_id, created_at DESC, id DESC);

CREATE INDEX check_ins_task_id_idx
    ON check_ins(task_id);

-- +goose Down

DROP TABLE check_ins;

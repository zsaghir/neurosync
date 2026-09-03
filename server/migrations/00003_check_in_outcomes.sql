-- +goose Up

-- These fields let us compare how stuck a user feels before and after support.
-- Behaviour is recorded separately so reported relief and actual progress are
-- not collapsed into one score.
ALTER TABLE check_ins
    ADD COLUMN stuckness_before SMALLINT NOT NULL
        CHECK (stuckness_before BETWEEN 0 AND 10),

    ADD COLUMN stuckness_after SMALLINT
        CHECK (stuckness_after BETWEEN 0 AND 10),

    ADD COLUMN intervention_attempted BOOLEAN,
    ADD COLUMN next_step_taken BOOLEAN,
    ADD COLUMN followed_up_at TIMESTAMPTZ,

    ADD CONSTRAINT check_ins_follow_up_consistent
        CHECK (
            (
                followed_up_at IS NULL
                AND stuckness_after IS NULL
                AND intervention_attempted IS NULL
                AND next_step_taken IS NULL
            )
            OR
            (
                followed_up_at IS NOT NULL
                AND followed_up_at >= created_at
                AND stuckness_after IS NOT NULL
                AND intervention_attempted IS NOT NULL
                AND (
                    (
                        intervention_attempted = TRUE
                        AND next_step_taken IS NOT NULL
                    )
                    OR
                    (
                        intervention_attempted = FALSE
                        AND next_step_taken IS NULL
                    )
                )
            )
        );

-- +goose Down

ALTER TABLE check_ins
    DROP CONSTRAINT check_ins_follow_up_consistent,
    DROP COLUMN followed_up_at,
    DROP COLUMN next_step_taken,
    DROP COLUMN intervention_attempted,
    DROP COLUMN stuckness_after,
    DROP COLUMN stuckness_before;

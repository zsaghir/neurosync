package tasks
import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/zsaghir/neurosync/server/internal/auth"
	"github.com/zsaghir/neurosync/server/internal/httpx"
)
const listQuery = `
SELECT
	task.id,
	task.title,
	task.completed,
	task.time_spent_seconds,
	task.estimated_minutes,
	task.notes,
	task.alarm_at,
	task.notification_id,
	task.completed_at,
	task.created_at
FROM tasks AS task
JOIN users AS owner ON owner.id = task.user_id
WHERE owner.clerk_user_id = $1
ORDER BY task.created_at DESC, task.id DESC`
const createQuery = `
WITH ensured_user AS (
	INSERT INTO users (clerk_user_id)
	VALUES ($1)
	ON CONFLICT (clerk_user_id) DO UPDATE
	SET clerk_user_id = EXCLUDED.clerk_user_id
	RETURNING id
)
INSERT INTO tasks (
	user_id,
	title,
	estimated_minutes,
	notes,
	alarm_at,
	notification_id
)
SELECT
	id,
	$2,
	$3,
	$4,
	$5,
	$6
FROM ensured_user
RETURNING
	id,
	title,
	completed,
	time_spent_seconds,
	estimated_minutes,
	notes,
	alarm_at,
	notification_id,
	completed_at,
	created_at`
const getQuery = `
	SELECT
		task.id,
		task.title,
		task.completed,
		task.time_spent_seconds,
		task.estimated_minutes,
		task.notes,
		task.alarm_at,
		task.notification_id,
		task.completed_at,
		task.created_at
	FROM tasks AS task
	JOIN users AS owner ON owner.id = task.user_id
	WHERE owner.clerk_user_id = $1
	  AND task.id = $2`
const updateQuery = `
	  UPDATE tasks AS task
	  SET
		  title = CASE
			  WHEN $3::boolean THEN $4::text
			  ELSE task.title
		  END,
	  
		  completed = CASE
			  WHEN $5::boolean THEN $6::boolean
			  ELSE task.completed
		  END,
	  
		  completed_at = CASE
			  WHEN NOT $5::boolean THEN task.completed_at
			  WHEN $6::boolean THEN COALESCE(task.completed_at, NOW())
			  ELSE NULL
		  END,
	  
		  estimated_minutes = CASE
			  WHEN $7::boolean THEN $8::integer
			  ELSE task.estimated_minutes
		  END,
	  
		  notes = CASE
			  WHEN $9::boolean THEN $10::text
			  ELSE task.notes
		  END,
	  
		  alarm_at = CASE
			  WHEN $11::boolean THEN $12::timestamptz
			  ELSE task.alarm_at
		  END,
	  
		  notification_id = CASE
			  WHEN $13::boolean THEN $14::text
			  ELSE task.notification_id
		  END,
	  
		  time_spent_seconds =
			  task.time_spent_seconds + COALESCE($15::integer, 0)
	  
	  FROM users AS owner
	  WHERE task.user_id = owner.id
		AND owner.clerk_user_id = $1
		AND task.id = $2
		AND task.time_spent_seconds + COALESCE($15::integer, 0) >= 0
	  RETURNING
		  task.id,
		  task.title,
		  task.completed,
		  task.time_spent_seconds,
		  task.estimated_minutes,
		  task.notes,
		  task.alarm_at,
		  task.notification_id,
		  task.completed_at,
		  task.created_at`
const ownedTaskExistsQuery = `
		  SELECT EXISTS (
			  SELECT 1
			  FROM tasks AS task
			  JOIN users AS owner ON owner.id = task.user_id
			  WHERE owner.clerk_user_id = $1
				AND task.id = $2
		  )`
const deleteQuery = `
		  DELETE FROM tasks AS task
		  USING users AS owner
		  WHERE task.user_id = owner.id
			AND owner.clerk_user_id = $1
			AND task.id = $2
		  RETURNING task.id`

/**
 * Every cached server resource is namespaced by the signed-in user, so one
 * account can never read another account's cached data.
 *
 * `task(userId, id)` starts with `tasks(userId)`, so invalidating the task
 * list prefix also refreshes every cached task detail.
 */
export const queryKeys = {
  user: (userId: string) => ["user", userId] as const,
  tasks: (userId: string) => ["user", userId, "tasks"] as const,
  task: (userId: string, taskId: string) => ["user", userId, "tasks", taskId] as const,
  taskSessions: (userId: string) => ["user", userId, "task-sessions"] as const,
  settings: (userId: string) => ["user", userId, "settings"] as const,
  checkInInsights: (userId: string) => ["user", userId, "check-in-insights"] as const,
};

/** Placeholder scope for disabled queries while nobody is signed in. */
export const SIGNED_OUT_SCOPE = "signed-out";

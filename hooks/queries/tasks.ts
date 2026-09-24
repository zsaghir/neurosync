import {
  deleteTask,
  fetchTaskById,
  fetchTasks,
  setTaskNotes,
  toggleTaskComplete,
  type TaskDocument,
} from "@/lib/api/tasks";
import {
  fetchTaskSessions,
  type TaskSessionDocument,
} from "@/lib/api/taskSessions";
import { queryKeys } from "@/lib/query/keys";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useQueryScope } from "./use-query-scope";

/** Applies `patch` to one task in both the task list and its detail entry. */
export function patchTaskInCache(
  queryClient: QueryClient,
  scope: string,
  taskId: string,
  patch: (task: TaskDocument) => TaskDocument,
) {
  queryClient.setQueryData<TaskDocument[]>(queryKeys.tasks(scope), (tasks) =>
    tasks?.map((task) => (task._id === taskId ? patch(task) : task)),
  );
  queryClient.setQueryData<TaskDocument>(queryKeys.task(scope, taskId), (task) =>
    task ? patch(task) : task,
  );
}

export function addTaskToCache(queryClient: QueryClient, scope: string, task: TaskDocument) {
  queryClient.setQueryData<TaskDocument[]>(queryKeys.tasks(scope), (tasks) =>
    tasks ? [task, ...tasks.filter((existing) => existing._id !== task._id)] : tasks,
  );
  queryClient.setQueryData(queryKeys.task(scope, task._id), task);
}

export function addSessionToCache(
  queryClient: QueryClient,
  scope: string,
  session: TaskSessionDocument,
) {
  queryClient.setQueryData<TaskSessionDocument[]>(queryKeys.taskSessions(scope), (sessions) =>
    sessions ? [...sessions, session] : sessions,
  );
}

/**
 * Stops in-flight reads of a task so a response that started before a write
 * cannot land afterwards and overwrite the newer local value.
 */
const cancelTaskReads = (queryClient: QueryClient, scope: string, taskId: string) =>
  Promise.all([
    queryClient.cancelQueries({ queryKey: queryKeys.tasks(scope), exact: true }),
    queryClient.cancelQueries({ queryKey: queryKeys.task(scope, taskId), exact: true }),
  ]);

export function useTasks() {
  const { getToken, userId, scope } = useQueryScope();

  return useQuery({
    queryKey: queryKeys.tasks(scope),
    queryFn: () => fetchTasks(getToken),
    enabled: userId != null,
  });
}

/**
 * One task's details. When the task list is cached, its copy of the task is
 * shown immediately (with the list's age) instead of starting from a spinner.
 */
export function useTask(taskId: string | undefined) {
  const { getToken, userId, scope } = useQueryScope();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.task(scope, taskId ?? ""),
    queryFn: () => fetchTaskById(getToken, taskId ?? ""),
    enabled: userId != null && Boolean(taskId),
    initialData: () =>
      queryClient
        .getQueryData<TaskDocument[]>(queryKeys.tasks(scope))
        ?.find((task) => task._id === taskId),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(queryKeys.tasks(scope))?.dataUpdatedAt,
  });
}

export function useTaskSessions() {
  const { getToken, userId, scope } = useQueryScope();

  return useQuery({
    queryKey: queryKeys.taskSessions(scope),
    queryFn: () => fetchTaskSessions(getToken),
    enabled: userId != null,
  });
}

/**
 * Optimistically toggles completion in every cached copy of the task, rolls
 * back on failure, and ignores repeat taps while a toggle for that task is
 * still saving.
 */
export function useToggleTaskComplete() {
  const { getToken, scope } = useQueryScope();
  const queryClient = useQueryClient();
  const savingTaskIds = useRef(new Set<string>());

  const mutation = useMutation({
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      toggleTaskComplete(getToken, taskId, completed),
    onMutate: async ({ taskId, completed }) => {
      await cancelTaskReads(queryClient, scope, taskId);
      patchTaskInCache(queryClient, scope, taskId, (task) => ({ ...task, completed }));
    },
    onError: (_error, { taskId, completed }) => {
      patchTaskInCache(queryClient, scope, taskId, (task) => ({ ...task, completed: !completed }));
    },
    onSuccess: (savedTask) => {
      patchTaskInCache(queryClient, scope, savedTask._id, () => savedTask);
    },
  });

  const { mutate } = mutation;
  const toggle = useCallback(
    (task: TaskDocument) => {
      if (savingTaskIds.current.has(task._id)) return;
      savingTaskIds.current.add(task._id);
      mutate(
        { taskId: task._id, completed: !task.completed },
        { onSettled: () => savingTaskIds.current.delete(task._id) },
      );
    },
    [mutate],
  );

  return { ...mutation, toggle };
}

export function useSaveTaskNotes() {
  const { getToken, scope } = useQueryScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, notes }: { taskId: string; notes: string | null }) =>
      setTaskNotes(getToken, taskId, notes),
    onMutate: ({ taskId }) => cancelTaskReads(queryClient, scope, taskId),
    onSuccess: (savedTask) => {
      patchTaskInCache(queryClient, scope, savedTask._id, () => savedTask);
    },
  });
}

export function useDeleteTask() {
  const { getToken, scope } = useQueryScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => deleteTask(getToken, taskId),
    onMutate: (taskId) => cancelTaskReads(queryClient, scope, taskId),
    onSuccess: (_result, taskId) => {
      // The detail entry is left for garbage collection: removing it while the
      // details screen is still animating away would make it refetch a 404.
      queryClient.setQueryData<TaskDocument[]>(queryKeys.tasks(scope), (tasks) =>
        tasks?.filter((task) => task._id !== taskId),
      );
    },
  });
}

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const { act, create } = require("react-test-renderer");
const { QueryClient, QueryClientProvider, notifyManager } = require("@tanstack/react-query");

notifyManager.setScheduler((callback) => callback());

const originalLoader = Module._load;
const originalTS = require.extensions[".ts"];
const originalTSX = require.extensions[".tsx"];
const originalAct = global.IS_REACT_ACT_ENVIRONMENT;
global.IS_REACT_ACT_ENVIRONMENT = true;

let focused = true;
let auth;
let taskAPI;
let sessionAPI;
Module._load = function (name, parent, main) {
  if (name === "react-native") return {
    AppState: { addEventListener: () => ({ remove() {} }) },
    Platform: { OS: "ios" },
  };
  if (name === "@clerk/clerk-expo") return { useAuth: () => ({ ...auth, getToken: async () => "test-token" }) };
  if (name === "@react-navigation/native") return {
    useFocusEffect: (callback) => React.useEffect(() => (focused ? callback() : undefined), [callback, focused]),
  };
  if (name === "@/lib/api/tasks") return new Proxy({}, { get: (_target, key) => (...args) => taskAPI[key](...args) });
  if (name === "@/lib/api/taskSessions") return new Proxy({}, { get: (_target, key) => (...args) => sessionAPI[key](...args) });
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoader.call(this, name, parent, main);
};
const compile = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, filename);
require.extensions[".ts"] = compile;
require.extensions[".tsx"] = compile;

const { useTask, useTasks, useToggleTaskComplete } = require("../hooks/queries/tasks.ts");
const { useRefreshOnFocus } = require("../hooks/use-refresh-on-focus.ts");
const { useTaskSession } = require("../hooks/use-task-session.ts");
const { queryKeys } = require("../lib/query/keys.ts");
const { shouldRetryRequest } = require("../lib/query/client.ts");
const { QueryProvider } = require("../context/QueryProvider.tsx");
const { APIRequestError, AuthenticationError } = require("../lib/api/client.ts");

test.after(() => {
  Module._load = originalLoader;
  require.extensions[".ts"] = originalTS;
  require.extensions[".tsx"] = originalTSX;
  global.IS_REACT_ACT_ENVIRONMENT = originalAct;
});

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const sample = (overrides = {}) => ({ _id: "task-1", title: "Test task", completed: false, timeSpentSeconds: 0, estimatedMinutes: null, notes: null, ...overrides });

function reset() {
  focused = true;
  auth = { isLoaded: true, isSignedIn: true, userId: "user-1" };
  taskAPI = { fetchTasks: async () => [sample()], fetchTaskById: async () => sample(), toggleTaskComplete: async (_t, id, completed) => sample({ _id: id, completed }) };
  sessionAPI = { fetchTaskSessions: async () => [], createTaskSession: async () => ({ _id: "session-1", taskId: "task-1" }) };
}
const newClient = (staleTime = 0) => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime }, mutations: { retry: false } } });

async function mountHook(useHook, client = newClient()) {
  const box = {};
  function Probe() { box.current = useHook(); return null; }
  const tree = () => React.createElement(QueryClientProvider, { client }, React.createElement(Probe));
  let root;
  await act(async () => { root = create(tree()); });
  return {
    client,
    get result() { return box.current; },
    async render() { await act(async () => root.update(tree())); },
    async close() { await act(async () => root.unmount()); client.clear(); },
  };
}

test("focus refresh skips the first focus and keeps data on screen while refetching", async () => {
  reset();
  let reads = 0;
  const pending = deferred();
  taskAPI.fetchTasks = async () => { reads++; return [sample()]; };
  const probe = await mountHook(() => {
    const query = useTasks();
    useRefreshOnFocus(queryKeys.tasks("user-1"));
    return query;
  });
  try {
    assert.equal(reads, 1, "mounting fetches once; the first focus must not fetch again");
    taskAPI.fetchTasks = () => { reads++; return pending.promise; };
    focused = false; await probe.render();
    focused = true; await probe.render();
    assert.equal(reads, 2);
    // The root cause of the flicker: a refresh must never look like a first load.
    assert.equal(probe.result.isPending, false);
    assert.equal(probe.result.isFetching, true);
    assert.equal(probe.result.data[0].title, "Test task");
    await act(async () => pending.resolve([sample({ title: "Renamed" })]));
    assert.equal(probe.result.data[0].title, "Renamed");
  } finally { await probe.close(); }
});

test("focus refresh does not refetch data that is still fresh", async () => {
  reset();
  let reads = 0;
  taskAPI.fetchTasks = async () => { reads++; return [sample()]; };
  const probe = await mountHook(() => {
    useRefreshOnFocus(queryKeys.tasks("user-1"));
    return useTasks();
  }, newClient(60_000));
  try {
    focused = false; await probe.render();
    focused = true; await probe.render();
    assert.equal(reads, 1);
  } finally { await probe.close(); }
});

test("task details open instantly from the cached list instead of a spinner", async () => {
  reset();
  let detailReads = 0;
  taskAPI.fetchTaskById = async () => { detailReads++; return sample(); };
  const client = newClient(60_000);
  client.setQueryData(queryKeys.tasks("user-1"), [sample({ title: "From list" })]);
  const probe = await mountHook(() => useTask("task-1"), client);
  try {
    assert.equal(probe.result.isPending, false);
    assert.equal(probe.result.data.title, "From list");
    assert.equal(detailReads, 0, "a fresh list copy is reused, not refetched");
  } finally { await probe.close(); }
});

test("a read that started before a toggle cannot overwrite it, and repeat taps are ignored", async () => {
  reset();
  const staleRead = deferred();
  let writes = 0;
  const probe = await mountHook(() => ({ list: useTasks(), detail: useTask("task-1"), completion: useToggleTaskComplete() }));
  try {
    taskAPI.fetchTasks = () => staleRead.promise;
    await act(async () => { void probe.result.list.refetch(); });
    const save = deferred();
    taskAPI.toggleTaskComplete = () => { writes++; return save.promise; };
    await act(async () => {
      probe.result.completion.toggle(sample());
      probe.result.completion.toggle(sample());
    });
    assert.equal(writes, 1);
    await act(async () => staleRead.resolve([sample({ completed: false })]));
    // Assert on the shared cache: it is what every screen renders from.
    const cachedList = () => probe.client.getQueryData(queryKeys.tasks("user-1"));
    const cachedDetail = () => probe.client.getQueryData(queryKeys.task("user-1", "task-1"));
    assert.equal(cachedList()[0].completed, true, "optimistic value survives the stale response");
    assert.equal(cachedDetail().completed, true, "detail cache is patched too");
    await act(async () => save.resolve(sample({ completed: true })));
    assert.equal(cachedList()[0].completed, true);
  } finally { await probe.close(); }
});

test("a failed toggle rolls back every cached copy and reports the error", async () => {
  reset();
  taskAPI.toggleTaskComplete = async () => { throw new Error("offline"); };
  const probe = await mountHook(() => ({ list: useTasks(), detail: useTask("task-1"), completion: useToggleTaskComplete() }));
  try {
    await act(async () => probe.result.completion.toggle(sample()));
    assert.equal(probe.client.getQueryData(queryKeys.tasks("user-1"))[0].completed, false);
    assert.equal(probe.client.getQueryData(queryKeys.task("user-1", "task-1")).completed, false);
    assert.ok(probe.result.completion.error);
  } finally { await probe.close(); }
});

test("cached data is scoped per user; another account never sees it", async () => {
  reset();
  taskAPI.fetchTasks = async () => [sample({ title: "User one private task" })];
  const probe = await mountHook(() => useTasks());
  try {
    assert.equal(probe.result.data[0].title, "User one private task");
    const second = deferred();
    taskAPI.fetchTasks = () => second.promise;
    auth = { isLoaded: true, isSignedIn: true, userId: "user-2" };
    await probe.render();
    assert.equal(probe.result.data, undefined);
    assert.equal(probe.result.isPending, true);
    await act(async () => second.resolve([sample({ title: "User two task" })]));
    assert.equal(probe.result.data[0].title, "User two task");
  } finally { await probe.close(); }
});

test("signing out clears the whole cache", async () => {
  reset();
  let client;
  function Grab() { client = require("@tanstack/react-query").useQueryClient(); return null; }
  const tree = () => React.createElement(QueryProvider, null, React.createElement(Grab));
  let root;
  await act(async () => { root = create(tree()); });
  try {
    client.setQueryData(queryKeys.tasks("user-1"), [sample()]);
    auth = { isLoaded: true, isSignedIn: false, userId: null };
    await act(async () => root.update(tree()));
    assert.equal(client.getQueryData(queryKeys.tasks("user-1")), undefined);
  } finally { await act(async () => root.unmount()); }
});

test("saving a session updates logged time and sessions everywhere, then refreshes from the server", async () => {
  reset();
  let listReads = 0;
  taskAPI.fetchTasks = async () => { listReads++; return [sample({ timeSpentSeconds: listReads > 1 ? 600 : 0 })]; };
  const probe = await mountHook(() => ({
    list: useTasks(),
    session: useTaskSession({ task: sample(), sessions: [], startedAt: null }),
  }), newClient(60_000));
  try {
    probe.client.setQueryData(queryKeys.taskSessions("user-1"), []);
    await act(async () => {
      await probe.result.session.saveSession({ timerSeconds: 600, actualSeconds: 600, actualSecondsSource: "timer" });
    });
    assert.equal(probe.client.getQueryData(queryKeys.taskSessions("user-1")).length, 1);
    assert.equal(listReads, 2, "the saved session invalidates task data");
    assert.equal(probe.result.list.data[0].timeSpentSeconds, 600);
  } finally { await probe.close(); }
});

test("requests that cannot succeed on retry are not retried", () => {
  assert.equal(shouldRetryRequest(0, new AuthenticationError("token_missing")), false);
  assert.equal(shouldRetryRequest(0, new APIRequestError("Not found", 404)), false);
  assert.equal(shouldRetryRequest(0, new APIRequestError("Server error", 503)), true);
  assert.equal(shouldRetryRequest(0, new Error("network")), true);
  assert.equal(shouldRetryRequest(2, new Error("network")), false);
});

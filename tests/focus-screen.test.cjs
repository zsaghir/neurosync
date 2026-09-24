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

let taskReads = 0;
let timerWrites = [];
const host = (name) => (props) => React.createElement(name, props, props.children);
const native = Object.fromEntries(["ActivityIndicator", "Pressable", "Text", "TextInput", "View"].map((name) => [name, host(name)]));
native.StyleSheet = { create: (styles) => styles };

Module._load = function (name, parent, main) {
  if (name === "react-native") return native;
  if (name === "react-native-safe-area-context") return { SafeAreaView: host("SafeAreaView") };
  if (name === "@clerk/clerk-expo") return { useAuth: () => ({ isLoaded: true, isSignedIn: true, userId: "user-1", getToken: async () => "test-token" }) };
  if (name === "expo-router") return { useRouter: () => ({ back() {} }), useLocalSearchParams: () => ({ taskId: "task-1" }) };
  if (name === "@/context/ActiveTimerContext") return { useActiveTimer: () => ({ activeTimer: null, setActiveTimer: (value) => timerWrites.push(value) }) };
  if (name === "@/lib/api/tasks") return { fetchTaskById: async () => { taskReads++; return sample(); }, fetchTasks: async () => [sample()] };
  if (name === "@/lib/api/taskSessions") return { fetchTaskSessions: async () => [], createTaskSession: async () => ({}) };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoader.call(this, name, parent, main);
};
const compile = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, filename);
require.extensions[".ts"] = compile;
require.extensions[".tsx"] = compile;

const FocusTimer = require("../app/(app)/focus/[taskId].tsx").default;
const { queryKeys } = require("../lib/query/keys.ts");

test.after(() => {
  Module._load = originalLoader;
  require.extensions[".ts"] = originalTS;
  require.extensions[".tsx"] = originalTSX;
  global.IS_REACT_ACT_ENVIRONMENT = originalAct;
});

function sample() {
  return { _id: "task-1", title: "Write report", completed: false, timeSpentSeconds: 0, estimatedMinutes: 25, notes: null };
}

test("focus timer opens straight to the clock from cached task data and is the single timer writer", async () => {
  taskReads = 0;
  timerWrites = [];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
  // What Task Details leaves in the cache before "Start focus".
  client.setQueryData(queryKeys.task("user-1", "task-1"), sample());
  client.setQueryData(queryKeys.taskSessions("user-1"), []);

  let root;
  await act(async () => {
    root = create(React.createElement(QueryClientProvider, { client }, React.createElement(FocusTimer)));
  });
  try {
    assert.equal(root.root.findAllByType("ActivityIndicator").length, 0, "no spinner before the clock");
    assert.ok(root.root.findAllByType("Text").some((node) => node.props.children === "0:00"));
    assert.equal(taskReads, 0, "the task is not fetched again");

    const published = timerWrites.filter(Boolean);
    assert.equal(published.length, 1, "the running timer is published once, not every tick");
    assert.equal(published[0].taskId, "task-1");
    assert.equal(published[0].accumulatedSeconds, 0);
    assert.ok(Math.abs(published[0].startedAt - Date.now()) < 1000);
  } finally {
    await act(async () => root.unmount());
    client.clear();
  }
  assert.equal(timerWrites.at(-1), null, "closing the screen clears the active timer");
});

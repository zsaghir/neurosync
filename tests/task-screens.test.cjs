const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const { act, create } = require("react-test-renderer");
const { QueryClient, QueryClientProvider, notifyManager } = require("@tanstack/react-query");

// Deliver cache updates synchronously so act() observes them.
notifyManager.setScheduler((callback) => callback());

const originalLoader = Module._load;
const originalTS = require.extensions[".ts"];
const originalTSX = require.extensions[".tsx"];
const originalAct = global.IS_REACT_ACT_ENVIRONMENT;
global.IS_REACT_ACT_ENVIRONMENT = true;
let focused = true;
let auth = { isLoaded: true, isSignedIn: true, userId: "user-1" };
let taskId = "task-1";
let pushes = [];
const router = { push: route => pushes.push(route), back() {} };
let taskAPI;
const host = name => props => React.createElement(name, props, props.children);
const native = Object.fromEntries(["ActivityIndicator", "Pressable", "ScrollView", "Text", "TextInput", "View"].map(name => [name, host(name)]));
native.StyleSheet = { create: styles => styles };

Module._load = function (name, parent, main) {
  if (name === "react-native") return native;
  if (name === "react-native-safe-area-context") return { SafeAreaView: host("SafeAreaView") };
  if (name === "@expo/vector-icons/Ionicons") return host("Icon");
  if (name === "@clerk/clerk-expo") return { useAuth: () => ({ ...auth, getToken: async () => "test-token" }) };
  if (name === "expo-router") return { useRouter: () => router, useLocalSearchParams: () => ({ id: taskId }) };
  if (name === "@react-navigation/native") return { useFocusEffect: callback => React.useEffect(() => focused ? callback() : undefined, [callback, focused]) };
  if (name === "@/context/AppThemeContext") return { useAppTheme: () => ({ colors: { accent: "blue", text: "black", background: "white" } }) };
  if (name === "@/context/ActiveTimerContext") return { useActiveTimer: () => ({ activeTimer: null }) };
  if (name === "@/lib/api/tasks") return new Proxy({}, { get: (_target, key) => (...args) => taskAPI[key](...args) });
  if (name === "@/lib/api/settings") return { fetchUserSettings: async () => ({}) };
  if (name === "@/lib/api/taskSessions") return { fetchTaskSessions: async () => [] };
  if (name === "@/hooks/use-task-session") return { useTaskSession: () => ({ openManualTime() {}, clearReview() {} }) };
  if (name === "@/components/tasks/ManualTimeSheet") return { ManualTimeSheet: host("ManualTimeSheet") };
  if (name === "@/components/tasks/AddTaskSheet") return { AddTaskSheet: host("AddTaskSheet") };
  if (name === "@/components/ui/PillButton") return { PillButton: host("PillButton") };
  if (name === "@/components/ui/design-system") return { SectionLabel: host("SectionLabel") };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoader.call(this, name, parent, main);
};
const compile = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, filename);
require.extensions[".ts"] = compile;
require.extensions[".tsx"] = compile;
const Details = require("../app/(app)/(tabs)/Tasks/[id].tsx").default;
const Tasks = require("../app/(app)/(tabs)/Tasks/index.tsx").default;
const { APIRequestError } = require("../lib/api/client.ts");

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
const sample = () => ({ _id: "task-1", title: "Test task", notes: "Saved notes", completed: false, timeSpentSeconds: 0, estimatedMinutes: null });
function reset() {
  focused = true; auth = { isLoaded: true, isSignedIn: true, userId: "user-1" }; pushes = []; taskId = "task-1";
  taskAPI = {
    fetchTaskById: async () => sample(), fetchTasks: async () => [sample()],
    toggleTaskComplete: async () => {}, setTaskNotes: async () => {}, deleteTask: async () => {},
  };
}
async function mount(Screen) {
  // staleTime 0 makes every refocus eligible for a background refresh, which
  // is the case these tests exercise.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
  const tree = () => React.createElement(QueryClientProvider, { client }, React.createElement(Screen));
  let root;
  await act(async () => { root = create(tree()); });
  return {
    root,
    async render() { await act(async () => root.update(tree())); },
    async close() { await act(async () => root.unmount()); client.clear(); },
  };
}
function button(root, label) {
  return root.findAllByType("Pressable").find(node => node.findAllByType("Text").some(text => text.props.children === label));
}

test("task details do not refetch on notes edits and retain drafts/content across focus refresh", async () => {
  reset(); let reads = 0;
  taskAPI.fetchTaskById = async () => { reads++; return sample(); };
  const screen = await mount(Details);
  try {
    assert.equal(reads, 1);
    await act(async () => button(screen.root.root, "Notes").props.onPress());
    await act(async () => screen.root.root.findByType("TextInput").props.onChangeText("Unsaved draft"));
    assert.equal(reads, 1);
    const scroll = screen.root.root.findByType("ScrollView");
    const pending = deferred();
    taskAPI.fetchTaskById = () => { reads++; return pending.promise; };
    focused = false; await screen.render();
    focused = true; await screen.render();
    assert.equal(reads, 2);
    assert.equal(screen.root.root.findAllByType("ActivityIndicator").length, 0);
    assert.equal(screen.root.root.findByType("ScrollView"), scroll);
    await act(async () => pending.resolve({ ...sample(), notes: "Remote notes" }));
    assert.equal(screen.root.root.findByType("TextInput").props.value, "Unsaved draft");
    await act(async () => button(screen.root.root, "Add time manually").props.onPress());
    assert.equal(screen.root.root.findByType("ManualTimeSheet").props.visible, true);
    await act(async () => screen.root.root.findByType("ManualTimeSheet").props.onClose());
    assert.equal(reads, 2);
  } finally { await screen.close(); }
});

test("checkbox changes completion without navigating; repeated title taps navigate once", async () => {
  reset(); let writes = 0;
  const pending = deferred();
  taskAPI.toggleTaskComplete = () => { writes++; return pending.promise; };
  const screen = await mount(Tasks);
  try {
    const checkbox = screen.root.root.findAllByType("Pressable").find(node => node.props.accessibilityRole === "checkbox");
    await act(async () => { checkbox.props.onPress(); checkbox.props.onPress(); });
    assert.equal(writes, 1);
    assert.equal(pushes.length, 0);
    await act(async () => pending.reject(new Error("offline")));
    assert.ok(screen.root.root.findAllByType("Text").some(node => String(node.props.children).includes("Couldn't save completion")));
    const open = screen.root.root.findAllByType("Pressable").find(node => node.props.accessibilityLabel === "Open task: Test task");
    // The checkbox is not nested in the navigation button.
    assert.equal(open.findAll(node => node.props.accessibilityRole === "checkbox").length, 0);
    await act(async () => { open.props.onPress(); open.props.onPress(); });
    assert.equal(pushes.length, 1);
  } finally { await screen.close(); }
});

test("details initial failure offers retry and missing tasks end loading", async () => {
  reset();
  taskAPI.fetchTaskById = async () => { throw new Error("offline"); };
  const screen = await mount(Details);
  try {
    assert.equal(screen.root.root.findAllByType("ActivityIndicator").length, 0);
    assert.ok(button(screen.root.root, "Retry"));
    taskAPI.fetchTaskById = async () => { throw new APIRequestError("Not found", 404); };
    await act(async () => button(screen.root.root, "Retry").props.onPress());
    assert.ok(screen.root.root.findAllByType("Text").some(node => node.props.children === "This task is no longer available."));
    assert.equal(button(screen.root.root, "Retry"), undefined);
  } finally { await screen.close(); }
});

test("list refresh failure retains its scroll view and existing rows", async () => {
  reset();
  const screen = await mount(Tasks);
  try {
    const scroll = screen.root.root.findByType("ScrollView");
    taskAPI.fetchTasks = async () => { throw new Error("offline"); };
    focused = false; await screen.render(); focused = true; await screen.render();
    assert.equal(screen.root.root.findByType("ScrollView"), scroll);
    assert.equal(screen.root.root.findAllByType("ActivityIndicator").length, 0);
    assert.ok(button(screen.root.root, "Retry"));
    assert.ok(screen.root.root.findAllByType("Text").some(node => node.props.children === "Test task"));
  } finally { await screen.close(); }
});

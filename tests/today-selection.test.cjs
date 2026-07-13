const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const originalLoader = require.extensions[".ts"];

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

test.after(() => {
  require.extensions[".ts"] = originalLoader;
});

const { getPreviousDaySeconds, selectRandomTasks } = require(path.join(
  projectRoot,
  "lib/utils/today.ts",
));

test("selectRandomTasks returns three unique incomplete tasks", () => {
  const tasks = [
    { _id: "1", completed: false },
    { _id: "2", completed: true },
    { _id: "3", completed: false },
    { _id: "4", completed: false },
    { _id: "5", completed: false },
  ];
  const values = [0.8, 0.1, 0.5, 0.3];
  let index = 0;
  const selected = selectRandomTasks(tasks, 3, () => values[index++]);

  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((task) => task._id)).size, 3);
  assert.equal(selected.some((task) => task.completed), false);
});

test("selectRandomTasks returns every active task when fewer than three exist", () => {
  const selected = selectRandomTasks(
    [
      { _id: "1", completed: false },
      { _id: "2", completed: true },
      { _id: "3", completed: false },
    ],
    3,
    () => 0,
  );

  assert.deepEqual(
    new Set(selected.map((task) => task._id)),
    new Set(["1", "3"]),
  );
});

test("getPreviousDaySeconds counts local yesterday and ignores excluded sessions", () => {
  const now = new Date(2026, 6, 13, 12, 0, 0);
  const yesterday = new Date(2026, 6, 12, 9, 30, 0).toISOString();
  const today = new Date(2026, 6, 13, 9, 30, 0).toISOString();

  const total = getPreviousDaySeconds(
    [
      { actualSeconds: 600, endedAt: yesterday },
      { actualSeconds: 1200, endedAt: yesterday, excludedFromInsights: true },
      { actualSeconds: 300, endedAt: today },
    ],
    now,
  );

  assert.equal(total, 600);
});

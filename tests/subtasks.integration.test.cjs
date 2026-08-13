const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const originalLoad = Module._load;
const originalTsLoader = require.extensions[".ts"];
const mocks = new Map();

require.extensions[".ts"] = (module, filename) => {
  const source = require("node:fs").readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

Module._load = function loadWithMocks(request, parent, isMain) {
  if (mocks.has(request)) return mocks.get(request);

  try {
    const resolvedRequest = Module._resolveFilename(request, parent, isMain);
    if (mocks.has(resolvedRequest)) return mocks.get(resolvedRequest);
  } catch {
    // Mocked aliases do not always resolve from disk.
  }

  if (request.startsWith("@/")) {
    const absoluteRequest = path.join(projectRoot, request.slice(2));
    if (mocks.has(absoluteRequest)) return mocks.get(absoluteRequest);
    return originalLoad.call(this, absoluteRequest, parent, isMain);
  }

  return originalLoad.call(this, request, parent, isMain);
};

const clearProjectModule = (relativePath) => {
  const absolutePath = path.join(projectRoot, relativePath);
  delete require.cache[require.resolve(absolutePath)];
};

const withAPIClientMock = async (authenticatedAPIRequest, callback) => {
  const clientMock = { authenticatedAPIRequest };
  mocks.set(path.join(projectRoot, "lib/api/client"), clientMock);
  mocks.set(path.join(projectRoot, "lib/api/client.ts"), clientMock);
  try {
    await callback();
  } finally {
    mocks.clear();
  }
};

test.after(() => {
  Module._load = originalLoad;
  require.extensions[".ts"] = originalTsLoader;
});

test("time wisdom helpers normalize titles and gate review prompts", () => {
  clearProjectModule("lib/utils/time-wisdom.ts");
  const {
    createTaskTitleSignature,
    getEstimateChoicesForMode,
    getPersonalDefaultMinutes,
    shouldPromptForLongSession,
    shouldPromptForShortSession,
    shouldShowDoneReflection,
  } = require(path.join(projectRoot, "lib/utils/time-wisdom.ts"));

  assert.equal(createTaskTitleSignature("Clean the kitchen!"), "clean kitchen");
  assert.equal(shouldPromptForShortSession(45), true);
  assert.equal(shouldPromptForShortSession(60), false);
  assert.equal(shouldPromptForLongSession(121 * 60, null), true);
  assert.equal(shouldPromptForLongSession(95 * 60, 30), true);
  assert.equal(getPersonalDefaultMinutes([20 * 60, 40 * 60]), null);
  assert.equal(getPersonalDefaultMinutes([20 * 60, 40 * 60, 30 * 60]), 30);
  assert.equal(
    shouldShowDoneReflection({
      cleanCountedSessionsToday: 0,
      cleanCountedSessionsTotal: 3,
    }),
    true,
  );
  assert.deepEqual(
    getEstimateChoicesForMode("minutes").map(({ label }) => label),
    ["15 min", "30 min", "60 min", "Skip estimation"],
  );
});

test("authenticated session helpers list and create without a client user ID", async () => {
  clearProjectModule("lib/api/taskSessions.ts");
  const calls = [];
  const getToken = async () => "session-token";
  const apiSession = {
    id: "aa0c4f09-a5c4-4f02-8e0b-619125f4483d",
    taskId: "0f1cf89d-d998-40c7-a8ac-43b89ff5c777",
    taskTitle: "Clean kitchen",
    taskTitleSignature: "clean kitchen",
    estimatedMinutes: 15,
    estimateInputType: "custom",
    timerMeasuredSeconds: 900,
    actualSeconds: 900,
    actualSecondsSource: "timer",
    startedAt: "2026-08-12T18:00:00Z",
    endedAt: "2026-08-12T18:15:00Z",
    excludedFromInsights: false,
    excludeReason: null,
    createdAt: "2026-08-12T18:15:00Z",
    updatedAt: "2026-08-12T18:15:00Z",
  };

  await withAPIClientMock(async (requestPath, suppliedGetToken, init = {}) => {
    calls.push({ requestPath, suppliedGetToken, init });
    return init.method ? apiSession : { sessions: [apiSession] };
  }, async () => {
    const { createTaskSession, fetchTaskSessions } = require(path.join(
      projectRoot,
      "lib/api/taskSessions.ts",
    ));

    const sessions = await fetchTaskSessions(getToken);
    assert.equal(sessions[0]._id, apiSession.id);
    assert.equal("id" in sessions[0], false);
    assert.equal(calls[0].requestPath, "/v1/task-sessions");
    assert.equal(calls[0].suppliedGetToken, getToken);

    await createTaskSession(getToken, {
      taskId: apiSession.taskId,
      estimatedMinutes: 15,
      estimateInputType: "custom",
      timerMeasuredSeconds: 900,
      actualSeconds: 900,
      actualSecondsSource: "timer",
      startedAt: apiSession.startedAt,
      endedAt: apiSession.endedAt,
      excludedFromInsights: false,
      excludeReason: null,
    });

    const body = JSON.parse(calls[1].init.body);
    assert.equal(calls[1].requestPath, "/v1/task-sessions");
    assert.equal(calls[1].init.method, "POST");
    assert.equal(calls[1].suppliedGetToken, getToken);
    assert.equal("userId" in body, false);
    assert.equal("taskTitle" in body, false);
    assert.equal(body.taskId, apiSession.taskId);
  });
});

test("authenticated task helpers call the Go API and normalize task IDs", async () => {
  clearProjectModule("lib/api/tasks.ts");
  const calls = [];
  const getToken = async () => "session-token";
  const apiTask = {
    id: "0f1cf89d-d998-40c7-a8ac-43b89ff5c777",
    title: "Clean kitchen",
    completed: false,
    timeSpentSeconds: 0,
    estimatedMinutes: 15,
    notes: null,
    alarmAt: null,
    notificationId: null,
    completedAt: null,
    createdAt: "2026-08-01T12:00:00Z",
  };

  await withAPIClientMock(async (requestPath, suppliedGetToken, init = {}) => {
    calls.push({ requestPath, suppliedGetToken, init });
    if (requestPath === "/v1/tasks" && !init.method) return { tasks: [apiTask] };
    if (init.method === "DELETE") return undefined;
    return apiTask;
  }, async () => {
    const { createTask, deleteTask, fetchTasks } = require(path.join(
      projectRoot,
      "lib/api/tasks.ts",
    ));

    const tasks = await fetchTasks(getToken);
    assert.equal(tasks[0]._id, apiTask.id);
    assert.equal("id" in tasks[0], false);

    await createTask(getToken, { title: "Clean kitchen", estimatedMinutes: 15 });
    assert.equal(calls[1].init.method, "POST");

    await deleteTask(getToken, apiTask.id);
    assert.equal(calls[2].init.method, "DELETE");
    assert.equal(calls[2].suppliedGetToken, getToken);
  });
});

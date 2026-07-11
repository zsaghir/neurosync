const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const originalLoad = Module._load;
const originalTsLoader = require.extensions[".ts"];
const originalTsxLoader = require.extensions[".tsx"];

const mocks = new Map();

const installTypeScriptLoader = () => {
  const loadTypeScript = (module, filename) => {
    const source = require("node:fs").readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: filename,
    });

    module._compile(output.outputText, filename);
  };

  require.extensions[".ts"] = loadTypeScript;
  require.extensions[".tsx"] = loadTypeScript;
};

const installMockLoader = () => {
  Module._load = function loadWithMocks(request, parent, isMain) {
    if (mocks.has(request)) {
      return mocks.get(request);
    }

    try {
      const resolvedRequest = Module._resolveFilename(request, parent, isMain);
      if (mocks.has(resolvedRequest)) {
        return mocks.get(resolvedRequest);
      }
    } catch {
      // Some mocked package names are intentionally not resolved from disk.
    }

    if (request.startsWith("@/")) {
      const absoluteRequest = path.join(projectRoot, request.slice(2));
      if (mocks.has(absoluteRequest)) {
        return mocks.get(absoluteRequest);
      }

      return originalLoad.call(this, absoluteRequest, parent, isMain);
    }

    return originalLoad.call(this, request, parent, isMain);
  };
};

const clearProjectModule = (relativePath) => {
  const absolutePath = path.join(projectRoot, relativePath);
  delete require.cache[require.resolve(absolutePath)];
};

const withMocks = async (mockEntries, callback) => {
  mocks.clear();
  for (const [request, mock] of mockEntries) {
    mocks.set(request, mock);
  }

  try {
    await callback();
  } finally {
    mocks.clear();
  }
};

installTypeScriptLoader();
installMockLoader();

test.after(() => {
  Module._load = originalLoad;
  require.extensions[".ts"] = originalTsLoader;
  require.extensions[".tsx"] = originalTsxLoader;
});

test("subtasks API returns generated subtasks for an owned task", async () => {
  clearProjectModule("app/api/subtasks+api.ts");

  const taskId = "task-1";
  const userId = "user-1";

  await withMocks(
    [
      [
        "@/lib/sanity/tasks",
        {
          fetchTaskById: async (requestedTaskId) => {
            assert.equal(requestedTaskId, taskId);

            return {
              _id: taskId,
              title: "Clean kitchen",
              userId,
            };
          },
        },
      ],
      [
        "@ai-sdk/google",
        {
          google: (model) => ({ model }),
        },
      ],
      [
        "ai",
        {
          Output: {
            object: ({ schema }) => ({ schema }),
          },
          generateText: async ({ model, output, prompt }) => {
            assert.deepEqual(model, { model: "gemini-2.5-flash" });
            assert.ok(output.schema);
            assert.match(prompt, /Clean kitchen/);

            return {
              output: {
                subtasks: [
                  { title: "Walk to the kitchen" },
                  { title: "Clear one counter" },
                ],
              },
            };
          },
        },
      ],
    ],
    async () => {
      const { POST } = require(path.join(projectRoot, "app/api/subtasks+api.ts"));
      const response = await POST(
        new Request("http://localhost/api/subtasks", {
          method: "POST",
          body: JSON.stringify({ taskId, userId }),
        }),
      );
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(
        body.subtasks.map(({ title, completed }) => ({ title, completed })),
        [
          { title: "Walk to the kitchen", completed: false },
          { title: "Clear one counter", completed: false },
        ],
      );
      assert.equal(typeof body.subtasks[0]._key, "string");
      assert.equal(typeof body.subtasks[1]._key, "string");
    },
  );
});

test("subtasks API rejects tasks owned by another user", async () => {
  clearProjectModule("app/api/subtasks+api.ts");

  await withMocks(
    [
      [
        "@/lib/sanity/tasks",
        {
          fetchTaskById: async () => ({
            _id: "task-1",
            title: "Clean kitchen",
            userId: "actual-owner",
          }),
        },
      ],
      ["@ai-sdk/google", { google: () => ({}) }],
      ["ai", { Output: { object: () => ({}) }, generateText: async () => ({}) }],
    ],
    async () => {
      const { POST } = require(path.join(projectRoot, "app/api/subtasks+api.ts"));
      const response = await POST(
        new Request("http://localhost/api/subtasks", {
          method: "POST",
          body: JSON.stringify({ taskId: "task-1", userId: "wrong-user" }),
        }),
      );
      const body = await response.json();

      assert.equal(response.status, 403);
      assert.deepEqual(body, { error: "Unauthorized" });
    },
  );
});

test("time wisdom helpers normalize titles and gate review prompts", async () => {
  clearProjectModule("lib/utils/time-wisdom.ts");

  const {
    createTaskTitleSignature,
    getEstimateChoicesForMode,
    shouldPromptForLongSession,
    shouldPromptForShortSession,
    getPersonalDefaultMinutes,
    shouldShowDoneReflection,
  } = require(path.join(projectRoot, "lib/utils/time-wisdom.ts"));

  assert.equal(createTaskTitleSignature("Clean the kitchen!"), "clean kitchen");
  assert.equal(createTaskTitleSignature("clean kitchen"), "clean kitchen");
  assert.equal(createTaskTitleSignature("Tidy kitchen"), "tidy kitchen");

  assert.equal(shouldPromptForShortSession(45), true);
  assert.equal(shouldPromptForShortSession(60), false);
  assert.equal(shouldPromptForLongSession(121 * 60, null), true);
  assert.equal(shouldPromptForLongSession(95 * 60, 30), true);
  assert.equal(shouldPromptForLongSession(60 * 60, 30), false);

  assert.equal(getPersonalDefaultMinutes([20 * 60, 40 * 60]), null);
  assert.equal(getPersonalDefaultMinutes([20 * 60, 40 * 60, 30 * 60]), 30);
  assert.equal(
    shouldShowDoneReflection({
      cleanCountedSessionsToday: 0,
      cleanCountedSessionsTotal: 3,
    }),
    true,
  );
  assert.equal(
    shouldShowDoneReflection({
      cleanCountedSessionsToday: 1,
      cleanCountedSessionsTotal: 6,
    }),
    false,
  );

  assert.deepEqual(
    getEstimateChoicesForMode("relative").map(({ label }) => label),
    ["Quick", "Medium", "Long", "Skip estimation"],
  );
  assert.deepEqual(
    getEstimateChoicesForMode("minutes").map(({ label }) => label),
    ["15 min", "30 min", "60 min", "Skip estimation"],
  );
  assert.deepEqual(
    getEstimateChoicesForMode("custom").map(({ label }) => label),
    ["Skip estimation"],
  );
});

test("task session helpers create, edit, exclude, and compare sessions", async () => {
  clearProjectModule("lib/sanity/taskSessions.ts");
  clearProjectModule("lib/sanity/client.ts");

  const createdDocs = [];
  const patchCalls = [];
  const sanityClient = {
    create: async (doc) => {
      createdDocs.push(doc);
      return { _id: "session-1", ...doc };
    },
    fetch: async () => [
      {
        _id: "session-1",
        taskTitle: "Clean the kitchen",
        taskTitleSignature: "clean kitchen",
        actualSeconds: 1800,
        excludedFromInsights: false,
      },
      {
        _id: "session-2",
        taskTitle: "Clean kitchen",
        taskTitleSignature: "clean kitchen",
        actualSeconds: 2400,
        excludedFromInsights: true,
      },
      {
        _id: "session-3",
        taskTitle: "Tidy kitchen",
        taskTitleSignature: "tidy kitchen",
        actualSeconds: 1200,
        excludedFromInsights: false,
      },
    ],
    patch: (sessionId) => {
      const call = { sessionId, operations: [] };
      patchCalls.push(call);
      return {
        set: (value) => {
          call.operations.push({ type: "set", value });
          return {
            commit: async () => ({ _id: sessionId, ...value }),
          };
        },
      };
    },
  };

  await withMocks(
    [
      [
        path.join(projectRoot, "lib/sanity/client"),
        {
          sanityClient,
        },
      ],
      [
        path.join(projectRoot, "lib/sanity/client.ts"),
        {
          sanityClient,
        },
      ],
    ],
    async () => {
      const {
        createTaskSession,
        fetchTaskSessions,
        updateTaskSessionActualTime,
        updateTaskSessionExclusion,
        getComparableSessionSeconds,
      } = require(path.join(projectRoot, "lib/sanity/taskSessions.ts"));

      const created = await createTaskSession({
        taskId: "task-1",
        userId: "user-1",
        taskTitle: "Clean the kitchen!",
        estimatedMinutes: 20,
        estimateInputType: "preset",
        timerMeasuredSeconds: 1200,
        actualSeconds: 1800,
        actualSecondsSource: "userEdited",
      });

      assert.equal(created.taskTitleSignature, "clean kitchen");
      assert.equal(created.timerMeasuredSeconds, 1200);
      assert.equal(created.actualSeconds, 1800);
      assert.equal(created.actualSecondsSource, "userEdited");
      assert.equal(createdDocs[0].excludedFromInsights, false);

      const sessions = await fetchTaskSessions("user-1");
      assert.deepEqual(getComparableSessionSeconds(sessions, "clean kitchen"), [
        1800,
      ]);

      await updateTaskSessionActualTime("session-1", 2100, "userEdited");
      assert.equal(patchCalls[0].operations[0].value.actualSeconds, 2100);
      assert.equal(
        patchCalls[0].operations[0].value.actualSecondsSource,
        "userEdited",
      );

      await updateTaskSessionExclusion("session-1", true, "weird");
      assert.equal(
        patchCalls[1].operations[0].value.excludedFromInsights,
        true,
      );
      assert.equal(patchCalls[1].operations[0].value.excludeReason, "weird");
    },
  );
});

test("user settings helpers create defaults, map legacy settings, fetch, and update preferences", async () => {
  clearProjectModule("lib/sanity/userSettings.ts");
  clearProjectModule("lib/sanity/client.ts");

  const createdDocs = [];
  const patchCalls = [];
  let existingSettings = null;
  const sanityClient = {
    create: async (doc) => {
      createdDocs.push(doc);
      existingSettings = { _id: "settings-1", ...doc };
      return existingSettings;
    },
    fetch: async () => existingSettings,
    patch: (settingsId) => {
      const call = { settingsId, operations: [] };
      patchCalls.push(call);

      return {
        set: (value) => {
          call.operations.push({ type: "set", value });
          return {
            commit: async () => {
              existingSettings = { ...existingSettings, ...value };
              return existingSettings;
            },
          };
        },
      };
    },
  };

  await withMocks(
    [
      [
        path.join(projectRoot, "lib/sanity/client"),
        {
          sanityClient,
        },
      ],
      [
        path.join(projectRoot, "lib/sanity/client.ts"),
        {
          sanityClient,
        },
      ],
    ],
    async () => {
      const {
        fetchUserSettings,
        mapLegacyTimeEstimationMode,
        updateUserSettings,
      } = require(path.join(projectRoot, "lib/sanity/userSettings.ts"));

      const defaults = await fetchUserSettings("user-1");

      assert.equal(defaults.userId, "user-1");
      assert.equal(defaults.preferredTimeEstimationMode, "relative");
      assert.equal(defaults.themeMode, "dark");
      assert.equal(createdDocs.length, 1);
      assert.equal(mapLegacyTimeEstimationMode("bucket"), "relative");
      assert.equal(mapLegacyTimeEstimationMode("presetMinutes"), "minutes");
      assert.equal(mapLegacyTimeEstimationMode("customMinutes"), "custom");
      assert.equal(mapLegacyTimeEstimationMode("skip"), "relative");

      const fetched = await fetchUserSettings("user-1");
      assert.equal(fetched._id, "settings-1");
      assert.equal(createdDocs.length, 1);

      const updatedEstimate = await updateUserSettings("settings-1", {
        preferredTimeEstimationMode: "minutes",
      });
      assert.equal(updatedEstimate.preferredTimeEstimationMode, "minutes");

      const updatedTheme = await updateUserSettings("settings-1", {
        themeMode: "light",
      });
      assert.equal(updatedTheme.themeMode, "light");
      assert.equal(patchCalls.length, 2);
      assert.equal(
        patchCalls[0].operations[0].value.preferredTimeEstimationMode,
        "minutes",
      );
      assert.equal(patchCalls[1].operations[0].value.themeMode, "light");
    },
  );
});

test("Sanity task helpers save generated subtasks and toggle a subtask", async () => {
  clearProjectModule("lib/sanity/tasks.ts");
  clearProjectModule("lib/sanity/client.ts");

  const patchCalls = [];
  const sanityClient = {
    patch: (taskId) => {
      const call = { taskId, operations: [] };
      patchCalls.push(call);

      return {
        set: (value) => {
          call.operations.push({ type: "set", value });
          return {
            commit: async () => ({
              _id: taskId,
              ...value,
            }),
          };
        },
      };
    },
  };

  await withMocks(
    [
      [
        path.join(projectRoot, "lib/sanity/client"),
        {
          sanityClient,
        },
      ],
      [
        path.join(projectRoot, "lib/sanity/client.ts"),
        {
          sanityClient,
        },
      ],
    ],
    async () => {
      const { setTaskSubtasks, toggleSubtaskComplete } = require(path.join(
        projectRoot,
        "lib/sanity/tasks.ts",
      ));
      const subtasks = [
        { _key: "subtask-1", title: "Walk to the kitchen", completed: false },
      ];

      const savedTask = await setTaskSubtasks("task-1", subtasks);

      assert.deepEqual(savedTask.subtasks, subtasks);
      assert.deepEqual(patchCalls[0], {
        taskId: "task-1",
        operations: [{ type: "set", value: { subtasks } }],
      });

      await toggleSubtaskComplete("task-1", true, "subtask-1");

      assert.deepEqual(patchCalls[1], {
        taskId: "task-1",
        operations: [
          {
            type: "set",
            value: {
              'subtasks[_key == "subtask-1"].completed': true,
            },
          },
        ],
      });
    },
  );
});

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
        "@ai-sdk/openai",
        {
          openai: (model) => ({ model }),
        },
      ],
      [
        "ai",
        {
          Output: {
            object: ({ schema }) => ({ schema }),
          },
          generateText: async ({ model, output, prompt }) => {
            assert.deepEqual(model, { model: "gpt-5.5-2026-04-23" });
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
      ["@ai-sdk/openai", { openai: () => ({}) }],
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

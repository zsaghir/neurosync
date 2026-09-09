const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const checkInsPath = path.join(projectRoot, "lib/api/checkins.ts");
const clientPath = path.join(projectRoot, "lib/api/client");
const originalLoad = Module._load;
const originalTsLoader = require.extensions[".ts"];
let authenticatedAPIRequest;

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

Module._load = function loadWithClientMock(request, parent, isMain) {
  let resolved;
  try {
    resolved = Module._resolveFilename(request, parent, isMain);
  } catch {
    resolved = request;
  }

  if (resolved === clientPath || resolved === `${clientPath}.ts`) {
    return {
      authenticatedAPIRequest: (...args) => authenticatedAPIRequest(...args),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

test.after(() => {
  Module._load = originalLoad;
  require.extensions[".ts"] = originalTsLoader;
});

test("check-in client creates a check-in and records its outcome", async () => {
  const calls = [];
  const getToken = async () => "session-token";
  authenticatedAPIRequest = async (...args) => {
    calls.push(args);
    return { id: "check-in-id" };
  };
  delete require.cache[require.resolve(checkInsPath)];
  const { createCheckIn, recordCheckInOutcome } = require(checkInsPath);

  await createCheckIn(getToken, {
    blocker: "task_initiation",
    supportAction: "five_minute_start",
    nextStep: "Open the document",
    plannedMinutes: 5,
    stucknessBefore: 8,
  });

  assert.equal(calls[0][0], "/v1/check-ins");
  assert.equal(calls[0][1], getToken);
  assert.equal(calls[0][2].method, "POST");
  assert.deepEqual(JSON.parse(calls[0][2].body), {
    blocker: "task_initiation",
    supportAction: "five_minute_start",
    nextStep: "Open the document",
    plannedMinutes: 5,
    stucknessBefore: 8,
  });

  await recordCheckInOutcome(getToken, "check-in-id", {
    stucknessAfter: 4,
    interventionAttempted: true,
    nextStepTaken: true,
    helpfulness: "yes",
  });

  assert.equal(calls[1][0], "/v1/check-ins/check-in-id/outcome");
  assert.equal(calls[1][2].method, "PATCH");
  assert.deepEqual(JSON.parse(calls[1][2].body), {
    stucknessAfter: 4,
    interventionAttempted: true,
    nextStepTaken: true,
    helpfulness: "yes",
  });
});

test("check-in client requests guided suggestions", async () => {
  const calls = [];
  const getToken = async () => "session-token";
  authenticatedAPIRequest = async (...args) => {
    calls.push(args);
    return { suggestions: [] };
  };
  delete require.cache[require.resolve(checkInsPath)];
  const { requestCheckInSuggestions } = require(checkInsPath);

  await requestCheckInSuggestions(getToken, {
    taskId: "task-id",
    blocker: "task_initiation",
    brainDump: "I have too many possible starting points.",
    capacity: "lower_than_usual",
    sleep: "too_short",
    basicNeeds: "not_really",
    medicationShift: false,
    substanceImpact: false,
    difficulties: ["task_too_large", "first_step_unclear"],
  });

  assert.equal(calls[0][0], "/v1/check-in-suggestions");
  assert.equal(calls[0][1], getToken);
  assert.equal(calls[0][2].method, "POST");
  assert.deepEqual(JSON.parse(calls[0][2].body), {
    taskId: "task-id",
    blocker: "task_initiation",
    brainDump: "I have too many possible starting points.",
    capacity: "lower_than_usual",
    sleep: "too_short",
    basicNeeds: "not_really",
    medicationShift: false,
    substanceImpact: false,
    difficulties: ["task_too_large", "first_step_unclear"],
  });
});

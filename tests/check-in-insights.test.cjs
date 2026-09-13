const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const clientPath = path.join(projectRoot, "lib/api/client");
const insightsAPIPath = path.join(projectRoot, "lib/api/insights.ts");
const insightHelpersPath = path.join(projectRoot, "lib/insights/check-in-insights.ts");
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

Module._load = function loadWithMocks(request, parent, isMain) {
  if (request.startsWith("@/")) {
    return originalLoad.call(this, path.join(projectRoot, request.slice(2)), parent, isMain);
  }
  let resolved;
  try {
    resolved = Module._resolveFilename(request, parent, isMain);
  } catch {
    resolved = request;
  }
  if (resolved === clientPath || resolved === `${clientPath}.ts`) {
    return { authenticatedAPIRequest: (...args) => authenticatedAPIRequest(...args) };
  }
  return originalLoad.call(this, request, parent, isMain);
};

test.after(() => {
  Module._load = originalLoad;
  require.extensions[".ts"] = originalTsLoader;
});

test("insights client requests the authenticated backend endpoint", async () => {
  const calls = [];
  const getToken = async () => "session-token";
  authenticatedAPIRequest = async (...args) => {
    calls.push(args);
    return { totalCheckIns: 0, completedFollowUps: 0, followUpRate: null, patterns: [] };
  };
  delete require.cache[require.resolve(insightsAPIPath)];
  const { fetchCheckInInsights } = require(insightsAPIPath);

  await fetchCheckInInsights(getToken);

  assert.equal(calls[0][0], "/v1/check-in-insights");
  assert.equal(calls[0][1], getToken);
  assert.equal(calls[0].length, 2);
});

test("insights helpers distinguish loading, error, empty, and populated states", () => {
  delete require.cache[require.resolve(insightHelpersPath)];
  const { getInsightsViewState } = require(insightHelpersPath);
  const empty = { totalCheckIns: 0, completedFollowUps: 0, followUpRate: null, patterns: [] };
  const populated = { ...empty, totalCheckIns: 1 };

  assert.equal(getInsightsViewState(true, "", null), "loading");
  assert.equal(getInsightsViewState(false, "Failed", null), "error");
  assert.equal(getInsightsViewState(false, "", empty), "empty");
  assert.equal(getInsightsViewState(false, "", populated), "populated");
});

test("insights helpers format rates, sample thresholds, and stuckness direction", () => {
  const {
    attemptsUntilComparison,
    describeInsufficientData,
    describeStucknessChange,
    formatPercentage,
    insightAccessibilityLabel,
  } = require(insightHelpersPath);
  const base = {
    blocker: "task_initiation",
    supportAction: "tiny_step",
    createdCheckIns: 7,
    completedFollowUps: 6,
    attemptedCount: 6,
    nextStepTakenCount: 5,
    successRate: 5 / 6,
    averageStucknessImprovement: 2.4,
    insufficientData: false,
  };

  assert.equal(formatPercentage(5 / 6), "83%");
  assert.equal(formatPercentage(null), "—");
  assert.equal(attemptsUntilComparison(2), 3);
  assert.equal(describeInsufficientData(4), "Try this strategy 1 more time before NeuroSync compares its pattern.");
  assert.equal(describeStucknessChange(base), "Stuckness decreased by 2.4 points on average across 6 follow-ups.");
  assert.match(describeStucknessChange({ ...base, averageStucknessImprovement: -1.5 }), /increased by 1.5/);
  assert.match(describeStucknessChange({ ...base, averageStucknessImprovement: 0 }), /did not change/);
  assert.match(insightAccessibilityLabel(base), /5 of 6 attempts/);
});

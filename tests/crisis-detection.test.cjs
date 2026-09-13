const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const crisisPath = path.resolve(__dirname, "../lib/safety/crisis.ts");
const originalTsLoader = require.extensions[".ts"];

require.extensions[".ts"] = (module, filename) => {
  const source = require("node:fs").readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

test.after(() => {
  require.extensions[".ts"] = originalTsLoader;
});

test("client crisis detector recognizes direct immediate language", () => {
  delete require.cache[require.resolve(crisisPath)];
  const { requiresCrisisSupport } = require(crisisPath);

  for (const value of [
    "I want to kill myself.",
    "I'M   GOING TO END MY LIFE!",
    "I've been thinking about suicide.",
    "I’ll hurt myself tonight.",
    "I plan to self-harm.",
    "I am going to commit suicide.",
    "I am in immediate danger.",
    "I am in danger right now.",
    "Someone is trying to hurt me.",
  ]) {
    assert.equal(requiresCrisisSupport(value), true, value);
  }
});

test("client crisis detector avoids broad and negated language", () => {
  const { requiresCrisisSupport } = require(crisisPath);

  for (const value of [
    "This assignment is killing me.",
    "I'm dead tired.",
    "I want to kill this task.",
    "I am not going to kill myself.",
    "I don't want to kill myself.",
    "I'm studying suicide prevention.",
    'My story contains the line "I want to kill myself."',
    "My character wants to end her life.",
  ]) {
    assert.equal(requiresCrisisSupport(value), false, value);
  }
});

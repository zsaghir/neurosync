const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const clientPath = path.resolve(__dirname, "../lib/api/client.ts");
const originalFetch = global.fetch;
const originalAPIURL = process.env.EXPO_PUBLIC_API_URL;
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
  global.fetch = originalFetch;
  if (originalAPIURL === undefined) {
    delete process.env.EXPO_PUBLIC_API_URL;
  } else {
    process.env.EXPO_PUBLIC_API_URL = originalAPIURL;
  }
  require.extensions[".ts"] = originalTsLoader;
});

test("API errors preserve the response status and error code", async () => {
  process.env.EXPO_PUBLIC_API_URL = "https://api.example.test";
  global.fetch = async () => new Response(
    JSON.stringify({
      error: {
        code: "crisis_support_required",
        message: "Immediate support information should be displayed",
      },
    }),
    { status: 422, headers: { "Content-Type": "application/json" } },
  );
  delete require.cache[require.resolve(clientPath)];
  const { APIRequestError, authenticatedAPIRequest } = require(clientPath);

  await assert.rejects(
    authenticatedAPIRequest("/v1/check-in-suggestions", async () => "token"),
    (error) => {
      assert.equal(error instanceof APIRequestError, true);
      assert.equal(error.status, 422);
      assert.equal(error.code, "crisis_support_required");
      return true;
    },
  );
});

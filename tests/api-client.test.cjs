const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const clientPath = path.resolve(__dirname, "../lib/api/client.ts");
const originalFetch = global.fetch;
const originalAPIURL = process.env.EXPO_PUBLIC_API_URL;
const originalTsLoader = require.extensions[".ts"];
const originalDev = global.__DEV__;

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
  if (originalDev === undefined) delete global.__DEV__;
  else global.__DEV__ = originalDev;
});

test("token failures retain safe Clerk diagnostics and never send an API request", async () => {
  const { AuthenticationError, authenticatedAPIRequest } = require(clientPath);
  global.__DEV__ = true;
  let requests = 0;
  global.fetch = async () => { requests++; throw new Error("must not fetch"); };
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args);
  try {
    const clerkError = {
      errors: [{ code: "session_expired", message: 'Session expired; token="private-token" Bearer secret-bearer https://auth.test/?secret=hidden sk_test_privatekey eyJheader.payload.signature' }],
      headers: { Authorization: "never-log-this" },
    };
    await assert.rejects(authenticatedAPIRequest("/v1/tasks", async () => { throw clerkError; }), error => {
      assert.ok(error instanceof AuthenticationError);
      assert.equal(error.reason, "token_failed");
      assert.equal(error.code, "session_expired");
      return true;
    });
    assert.equal(requests, 0);
    const output = JSON.stringify(logs);
    assert.match(output, /Session expired/);
    assert.match(output, /session_expired/);
    for (const secret of ["private-token", "secret-bearer", "auth.test", "sk_test_privatekey", "eyJheader", "never-log-this"]) assert.ok(!output.includes(secret));
  } finally { console.error = originalError; }
});

test("null tokens have a distinct diagnostic and do not fetch", async () => {
  const { AuthenticationError, authenticatedAPIRequest } = require(clientPath);
  global.__DEV__ = true;
  global.fetch = async () => { throw new Error("must not fetch"); };
  const originalError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  try {
    await assert.rejects(authenticatedAPIRequest("/v1/tasks", async () => null), error => error instanceof AuthenticationError && error.reason === "token_missing");
    assert.equal(logs[0][1].message, "Clerk getToken() returned no token; the session may be unavailable or expired.");
  } finally { console.error = originalError; }
});

test("production token failures do not log provider details", async () => {
  const { authenticatedAPIRequest } = require(clientPath);
  global.__DEV__ = false;
  const originalError = console.error;
  let logs = 0;
  console.error = () => logs++;
  try {
    await assert.rejects(authenticatedAPIRequest("/v1/tasks", async () => { throw new Error("provider details"); }));
    assert.equal(logs, 0);
  } finally { console.error = originalError; }
});

test("a successful token is sent, and backend 401 stays an API error", async () => {
  const { APIRequestError, AuthenticationError, authenticatedAPIRequest } = require(clientPath);
  process.env.EXPO_PUBLIC_API_URL = "https://api.example.test";
  global.fetch = async (_url, init) => {
    assert.equal(init.headers.get("Authorization"), "Bearer test-token");
    return new Response(JSON.stringify({ error: { message: "Unauthorized" } }), { status: 401 });
  };
  await assert.rejects(authenticatedAPIRequest("/v1/tasks", async () => "test-token"), error => error instanceof APIRequestError && !(error instanceof AuthenticationError) && error.status === 401);
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

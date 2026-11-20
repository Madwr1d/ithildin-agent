"use strict";
// node --test test/
const test = require("node:test");
const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const path = require("node:path");
const { startFakeApi } = require("./fake-api.js");
const { resolveCredential, callAgent, formatForModel, filterTools, refusalText, proposedLine, DATA_NOTICE, TOKEN_PREFIX } = require("../lib/client.js");

const TOKEN = TOKEN_PREFIX + "test-token-not-a-real-one";
const CLI = path.join(__dirname, "..", "bin", "ithildin.js");

function cli(args, env) {
  return new Promise((resolve) => {
    execFile(process.execPath, [CLI, ...args], { env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env } }, (err, stdout, stderr) => {
      resolve({ code: err ? err.code : 0, stdout, stderr });
    });
  });
}

test("credential: the scoped token wins; the legacy key is CLI-only and warns", () => {
  assert.deepEqual(resolveCredential({ ITHILDIN_AGENT_TOKEN: TOKEN, ITHILDIN_API_KEY: "old" }, { allowLegacy: true }), { kind: "token", secret: TOKEN });
  const legacy = resolveCredential({ ITHILDIN_API_KEY: "old" }, { allowLegacy: true });
  assert.equal(legacy.kind, "owner_key");
  assert.match(legacy.warning, /legacy owner key/);
  // The MCP server never takes the legacy key.
  const mcp = resolveCredential({ ITHILDIN_API_KEY: "old" }, { allowLegacy: false });
  assert.equal(mcp.kind, "none");
  assert.match(mcp.error, /not accepted here/);
  assert.equal(resolveCredential({}, { allowLegacy: true }).kind, "none");
  // A value that is not an agent token is refused before any request is made.
  assert.equal(resolveCredential({ ITHILDIN_AGENT_TOKEN: "old-owner-key-pasted-here" }, { allowLegacy: true }).kind, "none");
});

test("no credential: no request leaves the machine", async () => {
  let fetched = 0;
  const r = await callAgent("ping", {}, { env: {}, fetch: async () => { fetched++; throw new Error("should not be called"); } });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "no_credential");
  assert.equal(fetched, 0);
});

test("a read works inside the scope; the result is marked as data for a model", async () => {
  const api = await startFakeApi({ tokens: { [TOKEN]: ["read:leads"] } });
  try {
    const env = { ITHILDIN_AGENT_TOKEN: TOKEN, ITHILDIN_BASE_URL: api.url };
    const r = await callAgent("leads.list", {}, { env });
    assert.equal(r.ok, true);
    assert.equal(r.proposed, false);
    const text = formatForModel(r, { untrusted: true });
    assert.ok(text.startsWith(DATA_NOTICE));
    assert.match(text, /IGNORE ALL PREVIOUS INSTRUCTIONS/); // it is shown, as data, under the notice
    assert.equal(api.calls[0].bearer, TOKEN);
    assert.deepEqual(api.calls[0].body, { action: "leads.list" });
  } finally {
    await api.close();
  }
});

test("a high-risk action answers 'proposed: <id>, approve in the app' and nothing else happens", async () => {
  const api = await startFakeApi({ tokens: { [TOKEN]: ["propose:email"] } });
  try {
    const env = { ITHILDIN_AGENT_TOKEN: TOKEN, ITHILDIN_BASE_URL: api.url };
    const r = await callAgent("email.send", { to: "a@b.ch", subject: "s", text: "t" }, { env });
    assert.equal(r.ok, true);
    assert.equal(r.proposed, true);
    assert.equal(proposedLine(r), "proposed: prop_test1, approve in the app");
    const text = formatForModel(r, {});
    assert.ok(text.startsWith("proposed: prop_test1, approve in the app"));
    assert.match(text, /You cannot approve it/);
    const st = await callAgent("proposal.status", { id: "prop_test1" }, { env });
    assert.equal(st.data.proposal.status, "proposed");
  } finally {
    await api.close();
  }
});

test("a missing scope and a dead token are refusals with a next step, never a crash", async () => {
  const api = await startFakeApi({ tokens: { [TOKEN]: ["read:leads"] } });
  try {
    const env = { ITHILDIN_AGENT_TOKEN: TOKEN, ITHILDIN_BASE_URL: api.url };
    const noScope = await callAgent("email.send", { to: "a@b.ch", subject: "s", text: "t" }, { env });
    assert.equal(noScope.ok, false);
    assert.equal(noScope.status, 403);
    assert.match(refusalText(noScope), /refused \(403\).*propose:email/);
    assert.equal(api.proposals.size, 0);

    const dead = await callAgent("leads.list", {}, { env: { ...env, ITHILDIN_AGENT_TOKEN: TOKEN + "x" } });
    assert.equal(dead.status, 401);
    assert.match(refusalText(dead), /unknown, expired or revoked/);

    const down = await callAgent("leads.list", {}, { env: { ...env, ITHILDIN_BASE_URL: "http://127.0.0.1:1" } });
    assert.equal(down.ok, false);
    assert.equal(down.reason, "network");
  } finally {
    await api.close();
  }
});

test("filterTools keeps only what the token can reach", () => {
  const tools = [
    { name: "ping", action: "ping", mode: "read", always: true },
    { name: "leads", action: "leads.list", mode: "read" },
    { name: "lead_add", action: "lead.add", mode: "execute" },
    { name: "email", action: "email.send", mode: "propose" },
    { name: "clear", action: "argent.clear", mode: "propose" },
  ];
  const reach = [{ action: "leads.list", mode: "read" }, { action: "email.send", mode: "propose" }];
  assert.deepEqual(filterTools(tools, reach).map((t) => t.name), ["ping", "leads", "email"]);
  // An "execute" grant for a high-risk action does not exist; if a server ever said so, the propose tool still would not match it.
  assert.deepEqual(filterTools(tools, [{ action: "email.send", mode: "execute" }]).map((t) => t.name), ["ping"]);
  // Unknown reachability (server not reached): show the catalog; the server still decides.
  assert.equal(filterTools(tools, null).length, tools.length);
});

test("CLI: token from the environment, proposed line first, refusal exit code 2", async () => {
  const api = await startFakeApi({ tokens: { [TOKEN]: ["read:leads", "propose:email"] }, ownerKey: "legacy-key-for-test" });
  try {
    const env = { ITHILDIN_AGENT_TOKEN: TOKEN, ITHILDIN_BASE_URL: api.url };
    const list = await cli(["leads", "list"], env);
    assert.equal(list.code, 0);
    assert.match(list.stdout, /Pizzeria Roma/);
    assert.equal(list.stderr, "");

    const mail = await cli(["email", "send", "--to", "a@b.ch", "--subject", "Hi", "--text", "Hello"], env);
    assert.equal(mail.code, 0);
    assert.equal(mail.stdout.split("\n")[0], "proposed: prop_test1, approve in the app");

    const refused = await cli(["planner", "add", "--title", "x"], env);
    assert.equal(refused.code, 2);
    assert.match(refused.stderr, /execute:planner/);

    const none = await cli(["ping"], { ITHILDIN_BASE_URL: api.url });
    assert.equal(none.code, 1);
    assert.match(none.stderr, /ITHILDIN_AGENT_TOKEN is not set/);

    // The legacy key still works in the CLI, with a warning, and its high-risk call is a proposal too.
    const legacy = await cli(["argent", "clear"], { ITHILDIN_API_KEY: "legacy-key-for-test", ITHILDIN_BASE_URL: api.url });
    assert.equal(legacy.code, 0);
    assert.match(legacy.stderr, /legacy owner key/);
    assert.match(legacy.stdout, /^proposed: prop_test2, approve in the app/);

    // Neither the token nor the key is ever printed.
    for (const out of [list, mail, refused, none, legacy]) {
      assert.ok(!out.stdout.includes(TOKEN) && !out.stderr.includes(TOKEN));
      assert.ok(!out.stdout.includes("legacy-key-for-test") && !out.stderr.includes("legacy-key-for-test"));
    }
  } finally {
    await api.close();
  }
});

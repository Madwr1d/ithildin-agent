"use strict";
// The MCP server end to end: start it over stdio against the fake API, list
// its tools with a real MCP client, call them. node --test test/
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { startFakeApi } = require("./fake-api.js");
const { TOKEN_PREFIX, DATA_NOTICE } = require("../lib/client.js");

const TOKEN = TOKEN_PREFIX + "test-token-not-a-real-one";
const SERVER = path.join(__dirname, "..", "mcp", "index.mjs");

async function connect(env) {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER],
    env: { PATH: process.env.PATH || "", SystemRoot: process.env.SystemRoot || "", ...env },
    stderr: "pipe",
  });
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(transport);
  return client;
}
const textOf = (res) => res.content.map((c) => c.text).join("\n");

test("MCP: a model sees only the tools its token can use, and no management tool at all", async () => {
  const api = await startFakeApi({ tokens: { [TOKEN]: ["read:leads", "execute:planner", "propose:email"] } });
  const client = await connect({ ITHILDIN_AGENT_TOKEN: TOKEN, ITHILDIN_BASE_URL: api.url });
  try {
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      "ithildin_dialer_queue",
      "ithildin_email_propose",
      "ithildin_leads_list",
      "ithildin_ping",
      "ithildin_planner_add",
      "ithildin_proposal_status",
    ]);
    for (const n of names) assert.doesNotMatch(n, /token|scope|approve|reject|kill/);
  } finally {
    await client.close();
    await api.close();
  }
});

test("MCP: a high-risk tool returns 'proposed: <id>, approve in the app'; a read is marked as data", async () => {
  const api = await startFakeApi({ tokens: { [TOKEN]: ["read:leads", "propose:email", "propose:devices"] } });
  const client = await connect({ ITHILDIN_AGENT_TOKEN: TOKEN, ITHILDIN_BASE_URL: api.url });
  try {
    const mail = await client.callTool({ name: "ithildin_email_propose", arguments: { to: "a@b.ch", subject: "Hi", text: "Hello" } });
    assert.ok(textOf(mail).startsWith("proposed: prop_test1, approve in the app"));
    assert.equal(api.proposals.get("prop_test1").action, "email.send");

    const exec = await client.callTool({ name: "ithildin_device_exec_propose", arguments: { deviceId: "dev_1", command: "whoami" } });
    assert.ok(textOf(exec).startsWith("proposed: prop_test2, approve in the app"));
    assert.deepEqual(api.proposals.get("prop_test2").params, { action: "device.job", deviceId: "dev_1", type: "exec", payload: { cmd: "whoami" } });

    const leads = await client.callTool({ name: "ithildin_leads_list", arguments: {} });
    assert.ok(textOf(leads).startsWith(DATA_NOTICE));

    const status = await client.callTool({ name: "ithildin_proposal_status", arguments: { id: "prop_test1" } });
    assert.match(textOf(status), /"status": "proposed"/);

    // The token never appears in what a model reads.
    for (const r of [mail, exec, leads, status]) assert.ok(!textOf(r).includes(TOKEN));
  } finally {
    await client.close();
    await api.close();
  }
});

test("MCP: the legacy owner key is not accepted; every tool says how to fix it", async () => {
  const api = await startFakeApi({ ownerKey: "legacy-key-for-test" });
  const client = await connect({ ITHILDIN_API_KEY: "legacy-key-for-test", ITHILDIN_BASE_URL: api.url });
  try {
    const res = await client.callTool({ name: "ithildin_ping", arguments: {} });
    assert.match(textOf(res), /legacy owner key and is not accepted here/);
    const clear = await client.callTool({ name: "ithildin_argent_clear_propose", arguments: {} });
    assert.match(textOf(clear), /ITHILDIN_AGENT_TOKEN/);
    assert.equal(api.calls.length, 0); // nothing was sent with the legacy key
  } finally {
    await client.close();
    await api.close();
  }
});

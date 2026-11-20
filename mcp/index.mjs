#!/usr/bin/env node
// Ithildin MCP server — the Agent API as MCP tools for Claude Desktop / CLI,
// Grok, or any MCP client.
//
// Auth: ITHILDIN_AGENT_TOKEN (a scoped agent token the owner creates in the
// Ithildin app: Internal → Agents). Optional ITHILDIN_BASE_URL.
//   claude mcp add ithildin -e ITHILDIN_AGENT_TOKEN=<token> -- node mcp/index.mjs
//
// What a model gets here:
//   • read tools and low-risk write tools, but only those the token's scopes
//     allow (the server tells us at startup);
//   • "propose" tools for high-risk actions. They never send, delete or run
//     anything: the server records a proposal and the owner approves it in the
//     app. The tool answers "proposed: <id>, approve in the app".
//   • no tool that creates a token, changes a scope or approves a proposal.
//     Those do not exist in the Agent API at all.
//
// The legacy owner key (ITHILDIN_API_KEY) is NOT accepted by this server.
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TOOLS } from "./tools.mjs";

const require = createRequire(import.meta.url);
const { resolveCredential, callAgent, formatForModel, filterTools } = require("../lib/client.js");

const credential = resolveCredential(process.env, { allowLegacy: false });
const call = (action, args) => callAgent(action, args, { credential });
const text = (s) => ({ content: [{ type: "text", text: s }] });

// Ask the server what this token can reach, and show the model only that.
// If the server cannot be reached now, show the catalog: every call is still
// checked by the server, so a tool the token cannot use is refused there.
let reachable = null;
if (credential.kind === "token") {
  const ping = await call("ping");
  if (ping.ok && Array.isArray(ping.data.actions)) reachable = ping.data.actions;
  else console.error(`[ithildin-mcp] could not read the token's scopes (${ping.error || "no answer"}). Showing all tools; the server still enforces the scopes.`);
} else {
  console.error(`[ithildin-mcp] ${credential.error}`);
}

const server = new McpServer({ name: "ithildin", version: "0.2.0" });

for (const tool of filterTools(TOOLS, reachable)) {
  server.tool(tool.name, tool.description, tool.shape, async (args) => {
    const result = await call(tool.action, tool.args ? tool.args(args) : args);
    return text(formatForModel(result)); // every result is marked as data, between delimiters
  });
}

await server.connect(new StdioServerTransport());

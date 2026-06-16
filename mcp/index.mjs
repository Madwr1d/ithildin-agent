#!/usr/bin/env node
// Ithildin MCP server — exposes the Agent API as MCP tools for Claude Desktop/CLI.
// Auth: ITHILDIN_API_KEY (env). Optional ITHILDIN_BASE_URL (default https://ithild.info).
//   claude mcp add ithildin node mcp/index.mjs
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = process.env.ITHILDIN_BASE_URL || "https://ithild.info";
const KEY = process.env.ITHILDIN_API_KEY || "";

async function call(action, args = {}) {
  if (!KEY) return { error: "ITHILDIN_API_KEY not set" };
  try {
    const res = await fetch(`${BASE}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ action, ...args }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || `HTTP ${res.status}` };
    return data;
  } catch (e) {
    return { error: String(e?.message || e) };
  }
}
const text = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] });

const server = new McpServer({ name: "ithildin", version: "0.1.0" });

server.tool("ithildin_ping", "Check auth + connectivity", {}, async () => text(await call("ping")));
server.tool("ithildin_leads_list", "List all sales leads", {}, async () => text(await call("leads.list")));
server.tool("ithildin_lead_add", "Add a sales lead",
  { businessName: z.string(), phone: z.string().optional(), city: z.string().optional(), industry: z.string().optional(), email: z.string().optional() },
  async (a) => text(await call("lead.add", a)));
server.tool("ithildin_dialer_queue", "Get the callable lead queue", {}, async () => text(await call("dialer.queue")));
server.tool("ithildin_dialer_outcome", "Log a call outcome for a lead",
  { leadId: z.string(), outcome: z.enum(["interested", "reached", "callback", "voicemail", "no_answer", "not_interested"]), leadName: z.string().optional(), note: z.string().optional() },
  async (a) => text(await call("dialer.outcome", a)));
server.tool("ithildin_planner_list", "List planner tasks", {}, async () => text(await call("planner.list")));
server.tool("ithildin_planner_add", "Add a planner task",
  { title: z.string(), project: z.string().optional(), dueDate: z.string().optional(), leadDays: z.number().optional() },
  async (a) => text(await call("planner.add", a)));
server.tool("ithildin_argent_summary", "Net worth / cashflow summary", {}, async () => text(await call("argent.summary")));
server.tool("ithildin_clients_list", "List CRM clients", {}, async () => text(await call("clients.list")));

await server.connect(new StdioServerTransport());

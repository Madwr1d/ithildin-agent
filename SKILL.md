---
name: ithildin-agent
description: Use to drive Ithildin (a Swiss operations portal) from the terminal — manage sales leads, run a cold-call queue and log outcomes, fill a task planner, and read finance summaries. Use whenever the user wants an agent to operate their Ithildin workspace (add leads, work the dialer, schedule tasks, check net worth) instead of clicking the web UI.
---

# Ithildin Agent

Drive Ithildin programmatically via its Agent API, using the `ithildin` CLI.

## Setup (once)
Set the API key the user gives you (owner-issued, server-side `ITHILDIN_API_KEY`):
```bash
export ITHILDIN_API_KEY="ith_..."        # required
export ITHILDIN_BASE_URL="https://ithild.info"   # optional (default)
```

## Run commands
No install needed — run straight from the repo with npx:
```bash
npx github:Madwr1d/ithildin-agent ping
```
(Or `npm i -g ithildin-cli` once it's published, then `ithildin ping`.)

## Commands
- `ithildin ping` — verify auth/connectivity.
- `ithildin leads list` — all leads.
- `ithildin lead-add --name "Pizzeria Roma" --phone "+41 44 ..." [--city --industry --email]` — add a lead.
- `ithildin dialer queue` — the callable lead queue.
- `ithildin dialer outcome --lead <id> --outcome interested|reached|callback|voicemail|no_answer|not_interested [--name --note]` — log a call.
- `ithildin planner list` — tasks.
- `ithildin planner add --title "Ship X" [--project --due 2026-07-01 --lead 14]` — add a task.
- `ithildin argent summary` — net worth / cashflow.
- `ithildin clients list` — CRM clients.

All commands print JSON. The key authenticates as the owner — keep it in the
environment, never echo it into chat. Auth failures return HTTP 401.

## Deep integration (MCP server)
For Claude Desktop / Claude CLI as native tools (instead of shelling out to the CLI):
```bash
git clone https://github.com/Madwr1d/ithildin-agent && cd ithildin-agent && npm i
export ITHILDIN_API_KEY="ith_..."
claude mcp add ithildin -- node mcp/index.mjs
```
Exposes tools: `ithildin_ping`, `ithildin_leads_list`, `ithildin_lead_add`,
`ithildin_dialer_queue`, `ithildin_dialer_outcome`, `ithildin_planner_list`,
`ithildin_planner_add`, `ithildin_argent_summary`, `ithildin_clients_list`.

## Example agent task
"Work my lead list": run `ithildin dialer queue`, and for each result help the
user call, then `ithildin dialer outcome --lead <id> --outcome ...`. Or "fill my
week": `ithildin planner add` for each task the user describes.

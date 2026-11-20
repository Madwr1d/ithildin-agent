# ithildin-cli / ithildin-agent

Make Ithildin **agent-ready**: a CLI, a skill and an MCP server so AI agents (Claude, Grok, any MCP client) can
work in the Ithildin operations portal — leads, cold-call dialer, task planner, clients, invoices and
Argent² finances — from the terminal instead of the web UI.

Built with the API → CLI → skill ladder (Nevo David's agent-ready framework).

## How access works

An agent works with a **scoped agent token**. The owner creates it in the Ithildin app
(Internal → Agents), picks its scopes and caps, and copies it once.

| The agent asks for | What happens |
|---|---|
| A read (list leads, read the ledger) | Runs, if the token has `read:<area>`. |
| A low-risk write (add a lead, add a task, draft an invoice) | Runs, if the token has `execute:<area>`. |
| A high-risk action (send an e-mail, send an invoice, clear the ledger, run a command on a PC) | **Never runs for a token.** With `propose:<area>` it becomes a proposal. The owner approves it in the app. The answer is `proposed: <id>, approve in the app`. |
| Creating a token, changing scopes, approving a proposal | Not possible through the Agent API. Only the owner can, signed in to the app. |

The server enforces this. The CLI and the MCP server only report the answer.

## Install / run

```bash
export ITHILDIN_AGENT_TOKEN="<your token>"   # from the app: Internal → Agents
npx github:Madwr1d/ithildin-agent ping       # run without installing
# or, once published:  npm i -g ithildin-cli  &&  ithildin ping
```

`ping` shows the token's scopes, caps and expiry.

As a Claude agent skill:

```bash
npx skills add Madwr1d/ithildin-agent
```

As an MCP server:

```bash
git clone https://github.com/Madwr1d/ithildin-agent && cd ithildin-agent && npm i
claude mcp add ithildin -e ITHILDIN_AGENT_TOKEN="<your token>" -- node mcp/index.mjs
```

The MCP server asks the server which actions the token can reach and shows the model only those tools.

## Commands

| Command | Scope |
|---|---|
| `ping`, `whoami`, `proposal status --id <id>` | none |
| `leads list`, `dialer queue` | `read:leads` |
| `lead-add`, `dialer outcome` | `execute:leads` |
| `planner list` | `read:planner` |
| `planner add` | `execute:planner` |
| `clients list`, `clients stored`, `clients history --client <id>` | `read:clients` |
| `invoice list` | `read:invoices` |
| `invoice draft --job <id>` | `execute:invoices` |
| `invoice send --job <id> --invoice <id>` | `propose:invoices` → proposal |
| `argent summary`, `argent ledger` | `read:argent` |
| `argent categorize` | `execute:argent` |
| `argent clear` | `propose:argent` → proposal |
| `email send --to --subject --text` | `propose:email` → proposal |
| `device list`, `device sysinfo --device <id>` | `read:devices` |
| `device exec --device <id> --cmd <command>` | `propose:devices` → proposal |

All commands print JSON. A proposal prints `proposed: <id>, approve in the app` on the first line.
Exit codes: `0` ok or proposed, `2` refused (401 / 403), `1` any other error.

See `SKILL.md` for the agent-facing guide.

## Moving from the old owner key

Earlier versions used one owner key in `ITHILDIN_API_KEY`. It had every right and no expiry.

1. Create a scoped token in the app for each agent.
2. Set `ITHILDIN_AGENT_TOKEN` where the agent runs and remove `ITHILDIN_API_KEY` there.
3. The CLI still accepts `ITHILDIN_API_KEY` during the move and prints a warning. The MCP server does not accept it.

Keep the token in your environment. Never paste it into a chat.

## Tests

```bash
npm i && npm test
```

The tests run the CLI and the MCP server against a small local stand-in for the API.

## License
MIT

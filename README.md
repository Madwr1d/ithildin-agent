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
| A high-risk action (send an e-mail, send an invoice, clear the ledger, run a command or read or write a file on a PC) | **Never runs for a token.** With `propose:<area>` it becomes a proposal. The owner approves it in the app. The answer is `proposed: <id>, approve in the app`. |
| Creating a token, changing scopes, approving a proposal | Not possible through the Agent API. Only the owner can, signed in to the app. |

The server enforces this. The CLI and the MCP server only report the answer.

Details that matter:

- An e-mail proposal takes `to`, `subject`, `text` and `from`, nothing else. The server renders the final message and shows the owner exactly what will be sent. HTML and other fields are refused.
- A device job reaches only the owner's own paired devices. `sysinfo` is the only read. There is no file tool: a file read on a PC is high-risk on the server and its result goes to the owner, not to the agent.
- `invoice draft` returns the existing draft when the job already has an unsent one. It does not take a new invoice number.
- `argent save` (API) is add-only: a row that matches a stored row is skipped, never merged into it.
- The token is sent over https only. `ITHILDIN_BASE_URL` must be `https://…`; plain `http://` is accepted for `localhost` and `127.0.0.1` only. With any other value no request is made.
- Every MCP tool result is marked as data and put between two delimiter lines with a random marker, so text inside a record cannot pose as an instruction or end the block.

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
3. Replace the old key's value on the host, or suspend the key in the app, on the same day. Do not leave an old key live "until nothing uses it": a key that was ever pasted into a chat is leaked.
4. The CLI still accepts `ITHILDIN_API_KEY` during the move and prints a warning. The MCP server does not accept it. On the server the old key has the limits of a default token, and every device job it sends is a proposal.

Keep the token in your environment. Never paste it into a chat.

## Tests

```bash
npm i && npm test
```

The tests run the CLI and the MCP server against a small local stand-in for the API.

## License
MIT

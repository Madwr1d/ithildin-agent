#!/usr/bin/env node
/* ithildin-cli — drive Ithildin from the terminal / an AI agent.

   Auth: ITHILDIN_AGENT_TOKEN, a scoped agent token the owner creates in the
   Ithildin app (Internal → Agents). Optional ITHILDIN_BASE_URL.

   The legacy owner key (ITHILDIN_API_KEY) still works here during the
   migration, with a warning on stderr. Its high-risk actions are proposals
   too (unless the deployment turned full mode on).

   High-risk commands (email send, invoice send, argent clear, device exec) do
   not run: they answer "proposed: <id>, approve in the app". */
const { Command } = require("commander");
const { resolveCredential, callAgent, proposedLine, refusalText } = require("../lib/client.js");

const credential = resolveCredential(process.env, { allowLegacy: true });

async function call(action, args = {}) {
  if (credential.kind === "none") {
    console.error(credential.error);
    process.exit(1);
  }
  if (credential.warning) console.error(`Warning: ${credential.warning}`);
  const result = await callAgent(action, args, { credential });
  if (!result.ok) {
    console.error(refusalText(result));
    process.exit(result.status === 401 || result.status === 403 ? 2 : 1);
  }
  if (result.proposed) {
    // The first line is the stable answer. The JSON follows.
    console.log(proposedLine(result));
    console.log(JSON.stringify(result.data, null, 2));
    return;
  }
  console.log(JSON.stringify(result.data, null, 2));
}

const program = new Command();
program
  .name("ithildin")
  .description("Drive Ithildin (leads, dialer, planner, Argent²) as an agent, inside the scopes of your token")
  .version("0.2.0");

program.command("ping").description("Check the token + connectivity; shows scopes, caps and expiry").action(() => call("ping"));
program.command("whoami").description("Alias of ping").action(() => call("ping"));

const leads = program.command("leads").description("Lead management");
leads.command("list").description("List all leads [read:leads]").action(() => call("leads.list"));

program.command("lead-add").description("Add a lead [execute:leads]")
  .requiredOption("--name <name>", "business name")
  .option("--phone <phone>").option("--city <city>").option("--industry <industry>").option("--email <email>")
  .action((o) => call("lead.add", { businessName: o.name, phone: o.phone, city: o.city, industry: o.industry, email: o.email }));

const dialer = program.command("dialer").description("Calling queue + outcomes");
dialer.command("queue").description("Get the callable lead queue [read:leads]").action(() => call("dialer.queue"));
dialer.command("outcome").description("Log a call outcome [execute:leads]")
  .requiredOption("--lead <id>").requiredOption("--outcome <outcome>", "interested|reached|callback|voicemail|no_answer|not_interested")
  .option("--name <name>").option("--note <note>")
  .action((o) => call("dialer.outcome", { leadId: o.lead, outcome: o.outcome, leadName: o.name, note: o.note }));

const planner = program.command("planner").description("Task planner");
planner.command("list").description("List tasks [read:planner]").action(() => call("planner.list"));
planner.command("add").description("Add a task [execute:planner]")
  .requiredOption("--title <title>").option("--project <project>").option("--due <yyyy-mm-dd>").option("--lead <days>")
  .action((o) => call("planner.add", { title: o.title, project: o.project, dueDate: o.due, leadDays: o.lead ? Number(o.lead) : undefined }));

const argent = program.command("argent").description("Finances");
argent.command("summary").description("Net worth / cashflow summary [read:argent]").action(() => call("argent.summary"));
argent.command("ledger").description("Read the ledger [read:argent]").action(() => call("argent.ledger"));
argent.command("categorize").description("Set a merchant's category [execute:argent]")
  .requiredOption("--description <text>").requiredOption("--category <category>")
  .action((o) => call("argent.categorize", { description: o.description, category: o.category }));
argent.command("clear").description("PROPOSE deleting the whole ledger [propose:argent]; the owner approves in the app")
  .action(() => call("argent.clear"));

const clients = program.command("clients").description("CRM clients");
clients.command("list").description("List clients [read:clients]").action(() => call("clients.list"));
clients.command("stored").description("List the clients created in the app or by an agent [read:clients]").action(() => call("client.list.kv"));
clients.command("history").description("A client's jobs, hours and invoices [read:clients]")
  .requiredOption("--client <id>").action((o) => call("work.history", { clientId: o.client }));

const invoice = program.command("invoice").description("Invoices");
invoice.command("list").description("List invoices [read:invoices]").option("--client <id>")
  .action((o) => call("invoice.list", { clientId: o.client }));
invoice.command("draft").description("Freeze a draft invoice for a job; nothing is sent [execute:invoices]")
  .requiredOption("--job <id>").action((o) => call("invoice.draft", { jobId: o.job }));
invoice.command("send").description("PROPOSE sending an invoice [propose:invoices]; the owner approves in the app")
  .requiredOption("--job <id>").requiredOption("--invoice <id>").option("--to <email>").option("--note <text>")
  .action((o) => call("invoice.send", { jobId: o.job, invoiceId: o.invoice, to: o.to, coverNote: o.note }));

const email = program.command("email").description("Outbound mail");
email.command("send").description("PROPOSE an e-mail [propose:email]; the owner approves in the app")
  .requiredOption("--to <email>").requiredOption("--subject <subject>").requiredOption("--text <text>").option("--from <email>")
  .action((o) => call("email.send", { to: o.to, subject: o.subject, text: o.text, from: o.from }));

const device = program.command("device").description("Paired devices");
device.command("list").description("List devices [read:devices]").action(() => call("device.list"));
device.command("sysinfo").description("CPU / RAM / disk snapshot of a device [read:devices]")
  .requiredOption("--device <id>").action((o) => call("device.job", { deviceId: o.device, type: "sysinfo" }));
device.command("exec").description("PROPOSE running a command on a device [propose:devices]; the owner approves in the app")
  .requiredOption("--device <id>").requiredOption("--cmd <command>")
  .action((o) => call("device.job", { deviceId: o.device, type: "exec", payload: { cmd: o.cmd } }));

const proposal = program.command("proposal").description("Proposals this token made");
proposal.command("status").description("State of a proposal: proposed | approved | rejected | expired")
  .requiredOption("--id <id>").action((o) => call("proposal.status", { id: o.id }));

program.parseAsync(process.argv);

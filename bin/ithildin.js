#!/usr/bin/env node
/* ithildin-cli — drive Ithildin from the terminal / an AI agent.
   Auth: set ITHILDIN_API_KEY (and optionally ITHILDIN_BASE_URL). */
const { Command } = require("commander");

const BASE = process.env.ITHILDIN_BASE_URL || "https://ithild.info";
const KEY = process.env.ITHILDIN_API_KEY || "";

async function call(action, args = {}) {
  if (!KEY) {
    console.error("Missing ITHILDIN_API_KEY. Set it in your environment first.");
    process.exit(1);
  }
  let res;
  try {
    res = await fetch(`${BASE}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ action, ...args }),
    });
  } catch (e) {
    console.error("Network error:", e.message);
    process.exit(1);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Error ${res.status}:`, data.error || "request failed");
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

const program = new Command();
program.name("ithildin").description("Drive Ithildin (leads, dialer, planner, Argent²) as an agent").version("0.1.0");

program.command("ping").description("Check auth + connectivity").action(() => call("ping"));

const leads = program.command("leads").description("Lead management");
leads.command("list").description("List all leads").action(() => call("leads.list"));

program.command("lead-add").description("Add a lead")
  .requiredOption("--name <name>", "business name")
  .option("--phone <phone>").option("--city <city>").option("--industry <industry>").option("--email <email>")
  .action((o) => call("lead.add", { businessName: o.name, phone: o.phone, city: o.city, industry: o.industry, email: o.email }));

const dialer = program.command("dialer").description("Calling queue + outcomes");
dialer.command("queue").description("Get the callable lead queue").action(() => call("dialer.queue"));
dialer.command("outcome").description("Log a call outcome")
  .requiredOption("--lead <id>").requiredOption("--outcome <outcome>", "interested|reached|callback|voicemail|no_answer|not_interested")
  .option("--name <name>").option("--note <note>")
  .action((o) => call("dialer.outcome", { leadId: o.lead, outcome: o.outcome, leadName: o.name, note: o.note }));

const planner = program.command("planner").description("Task planner");
planner.command("list").description("List tasks").action(() => call("planner.list"));
planner.command("add").description("Add a task")
  .requiredOption("--title <title>").option("--project <project>").option("--due <yyyy-mm-dd>").option("--lead <days>")
  .action((o) => call("planner.add", { title: o.title, project: o.project, dueDate: o.due, leadDays: o.lead ? Number(o.lead) : undefined }));

const argent = program.command("argent").description("Finances");
argent.command("summary").description("Net worth / cashflow summary").action(() => call("argent.summary"));

const clients = program.command("clients").description("CRM clients");
clients.command("list").description("List clients").action(() => call("clients.list"));

program.parseAsync(process.argv);

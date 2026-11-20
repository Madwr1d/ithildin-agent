// The MCP tool catalog. One entry per tool:
//   name    the MCP tool name
//   action  the Agent API action it calls
//   mode    what the server does with it for a token:
//             "read"     runs with read:<area>
//             "execute"  a low-risk write, runs with execute:<area>
//             "propose"  HIGH-RISK. The server never executes it for a token.
//                        It records a proposal; the owner approves in the app.
//   untrusted  the result carries stored content (lead notes, mail, documents)
//   always  no scope needed
//
// The server enforces all of this. The catalog only decides which tools a
// model is shown and how they are described.
import { z } from "zod";

const PROPOSE_NOTE =
  " This does NOT do it. It records a proposal that the owner must approve in the Ithildin app. The answer is \"proposed: <id>, approve in the app\".";

export const TOOLS = [
  // ── No scope ───────────────────────────────────────────────────────────
  { name: "ithildin_ping", action: "ping", mode: "read", always: true,
    description: "Check the token and the connection. Shows the token's scopes, caps and expiry.", shape: {} },
  { name: "ithildin_proposal_status", action: "proposal.status", mode: "read", always: true,
    description: "Read the state of a proposal this token made: proposed, approved, rejected or expired.",
    shape: { id: z.string().describe("The proposal id, e.g. prop_…") } },

  // ── Read ───────────────────────────────────────────────────────────────
  { name: "ithildin_leads_list", action: "leads.list", mode: "read", untrusted: true,
    description: "List all sales leads.", shape: {} },
  { name: "ithildin_dialer_queue", action: "dialer.queue", mode: "read", untrusted: true,
    description: "Get the callable lead queue.", shape: {} },
  { name: "ithildin_planner_list", action: "planner.list", mode: "read", untrusted: true,
    description: "List planner tasks.", shape: {} },
  { name: "ithildin_argent_summary", action: "argent.summary", mode: "read",
    description: "Net worth / cashflow summary.", shape: {} },
  { name: "ithildin_argent_ledger", action: "argent.ledger", mode: "read", untrusted: true,
    description: "Read the Argent ledger (transactions and a summary).", shape: {} },
  { name: "ithildin_clients_list", action: "clients.list", mode: "read", untrusted: true,
    description: "List CRM clients.", shape: {} },
  { name: "ithildin_clients_stored", action: "client.list.kv", mode: "read", untrusted: true,
    description: "List the clients created in the app or by an agent (with website and phone).", shape: {} },
  { name: "ithildin_work_history", action: "work.history", mode: "read", untrusted: true,
    description: "Read a client's jobs, logged hours, expenses and invoices.",
    shape: { clientId: z.string() } },
  { name: "ithildin_invoice_list", action: "invoice.list", mode: "read", untrusted: true,
    description: "List invoices, optionally for one client.",
    shape: { clientId: z.string().optional() } },
  { name: "ithildin_device_list", action: "device.list", mode: "read", untrusted: true,
    description: "List the paired devices.", shape: {} },

  // ── Execute (low-risk writes inside the owner's own data) ───────────────
  { name: "ithildin_lead_add", action: "lead.add", mode: "execute",
    description: "Add a sales lead (internal record).",
    shape: { businessName: z.string(), phone: z.string().optional(), city: z.string().optional(), industry: z.string().optional(), email: z.string().optional(), notes: z.string().optional() } },
  { name: "ithildin_dialer_outcome", action: "dialer.outcome", mode: "execute",
    description: "Log a call outcome for a lead.",
    shape: { leadId: z.string(), outcome: z.enum(["interested", "reached", "callback", "voicemail", "no_answer", "not_interested"]), leadName: z.string().optional(), note: z.string().optional() } },
  { name: "ithildin_planner_add", action: "planner.add", mode: "execute",
    description: "Add a planner task.",
    shape: { title: z.string(), project: z.string().optional(), dueDate: z.string().optional(), leadDays: z.number().optional() } },
  { name: "ithildin_client_create", action: "client.create", mode: "execute",
    description: "Create a client record (status: lead).",
    shape: { name: z.string(), contactName: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), city: z.string().optional(), industry: z.string().optional(), website: z.string().optional(), notes: z.string().optional() } },
  { name: "ithildin_invoice_draft", action: "invoice.draft", mode: "execute", untrusted: true,
    description: "Freeze a draft invoice for a job from its logged work. Nothing is sent.",
    shape: { jobId: z.string() } },
  { name: "ithildin_argent_categorize", action: "argent.categorize", mode: "execute",
    description: "Set the category for a merchant in the ledger.",
    shape: { description: z.string(), category: z.string() } },
  { name: "ithildin_research_business", action: "research.business", mode: "execute", untrusted: true,
    description: "Research a Swiss business on the web and return a short dossier (a draft).",
    shape: { name: z.string(), city: z.string().optional(), canton: z.string().optional(), website: z.string().optional() } },

  // ── Propose (high-risk: never executed for a token) ─────────────────────
  { name: "ithildin_email_propose", action: "email.send", mode: "propose",
    description: "Propose an e-mail from the owner's mailbox." + PROPOSE_NOTE,
    shape: { to: z.union([z.string(), z.array(z.string())]), subject: z.string(), text: z.string().describe("Plain text body"), from: z.string().optional() } },
  { name: "ithildin_invoice_send_propose", action: "invoice.send", mode: "propose",
    description: "Propose sending an invoice to the client by e-mail." + PROPOSE_NOTE,
    shape: { jobId: z.string(), invoiceId: z.string(), to: z.string().optional().describe("Leave empty to use the client's address on file"), coverNote: z.string().optional() } },
  { name: "ithildin_argent_clear_propose", action: "argent.clear", mode: "propose",
    description: "Propose deleting the whole Argent ledger." + PROPOSE_NOTE,
    shape: {} },
  { name: "ithildin_device_exec_propose", action: "device.job", mode: "propose",
    description: "Propose running a command on a paired device." + PROPOSE_NOTE,
    shape: { deviceId: z.string(), command: z.string().describe("The command line to run") },
    args: (a) => ({ deviceId: a.deviceId, type: "exec", payload: { cmd: a.command } }) },
];

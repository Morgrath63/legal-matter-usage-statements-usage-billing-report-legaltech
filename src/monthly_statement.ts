import { z } from "zod";
import { InfraiClient } from "./infrai_client.js";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export const statementRequestSchema = z.object({
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
  period: z.object({
    label: z.string().min(1),
    start: z.string().regex(isoDate),
    end: z.string().regex(isoDate),
  }),
  matters: z.array(z.object({
    matterId: z.string().min(1),
    title: z.string().min(1),
    intakeAt: z.string().datetime(),
    signedDocument: z.object({
      deliveredAt: z.string().datetime(),
    }).nullable(),
    deadline: z.string().regex(isoDate).nullable(),
    completed: z.boolean(),
  })).min(1),
});

export type StatementRequest = z.infer<typeof statementRequestSchema>;

export type MatterDecision = {
  matterId: string;
  status: "open" | "completed";
  signedDelivery: "delivered" | "pending";
  deadlineFollowUp: "due" | "not-due";
};

export function decideMatterFollowUps(input: StatementRequest, asOf: string): MatterDecision[] {
  const today = startOfUtcDay(asOf);
  return input.matters.map((matter) => {
    const daysUntilDeadline = matter.deadline === null
      ? Number.POSITIVE_INFINITY
      : (startOfUtcDay(matter.deadline).getTime() - today.getTime()) / 86_400_000;
    const followUpDue = !matter.completed
      && matter.signedDocument !== null
      && daysUntilDeadline >= 0
      && daysUntilDeadline <= 7;

    return {
      matterId: matter.matterId,
      status: matter.completed ? "completed" : "open",
      signedDelivery: matter.signedDocument === null ? "pending" : "delivered",
      deadlineFollowUp: followUpDue ? "due" : "not-due",
    };
  });
}

export async function sendMonthlyStatement(
  infrai: InfraiClient,
  input: StatementRequest,
  asOf = new Date().toISOString(),
): Promise<{ statementUrl: string; messageId: string; followUpMatterIds: string[] }> {
  const decisions = decideMatterFollowUps(input, asOf);
  const usage = await infrai.account.usage();
  const html = renderStatement(input, decisions, usage, asOf);
  const statementKey = `${input.customer.email}:${input.period.start}:${input.period.end}`;
  const pdf = await infrai.pdf.generate(
    { html, page_size: "A4", orientation: "portrait", store: true },
    `legal-statement-pdf:${statementKey}`,
  );

  const followUpMatterIds = decisions
    .filter((decision) => decision.deadlineFollowUp === "due")
    .map((decision) => decision.matterId);
  const email = await infrai.email.send({
    to: input.customer.email,
    subject: `${input.period.label} legal usage statement`,
    html: emailBody(input.customer.name, pdf.url, followUpMatterIds),
  }, `legal-statement-email:${statementKey}`);

  return { statementUrl: pdf.url, messageId: email.message_id, followUpMatterIds };
}

function renderStatement(
  input: StatementRequest,
  decisions: MatterDecision[],
  usage: Record<string, unknown>,
  asOf: string,
): string {
  const rows = input.matters.map((matter, index) => {
    const decision = decisions[index];
    const deliveredAt = matter.signedDocument?.deliveredAt ?? "Pending";
    return `<tr><td>${escapeHtml(matter.matterId)}</td><td>${escapeHtml(matter.title)}</td><td>${escapeHtml(matter.intakeAt)}</td><td>${escapeHtml(deliveredAt)}</td><td>${escapeHtml(matter.deadline ?? "None")}</td><td>${decision.deadlineFollowUp}</td></tr>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#17212b}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd3da;padding:8px;text-align:left}pre{white-space:pre-wrap}</style></head><body><h1>${escapeHtml(input.period.label)} usage statement</h1><p>Customer: ${escapeHtml(input.customer.name)}</p><p>Period: ${escapeHtml(input.period.start)} to ${escapeHtml(input.period.end)}</p><p>Prepared: ${escapeHtml(asOf)}</p><h2>Matter activity</h2><table><thead><tr><th>Matter</th><th>Title</th><th>Intake</th><th>Signed delivery</th><th>Deadline</th><th>Follow-up</th></tr></thead><tbody>${rows}</tbody></table><h2>Metered account usage</h2><pre>${escapeHtml(JSON.stringify(usage, null, 2))}</pre></body></html>`;
}

function emailBody(customerName: string, statementUrl: string, followUpMatterIds: string[]): string {
  const followUp = followUpMatterIds.length === 0
    ? "No deadline follow-ups are due."
    : `Deadline follow-up is due for: ${followUpMatterIds.map(escapeHtml).join(", ")}.`;
  return `<p>Hello ${escapeHtml(customerName)},</p><p>Your monthly usage statement is ready: <a href="${escapeHtml(statementUrl)}">download the PDF</a>.</p><p>${followUp}</p>`;
}

function startOfUtcDay(value: string): Date {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

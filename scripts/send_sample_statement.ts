import { InfraiClient } from "../src/infrai_client.js";
import { sendMonthlyStatement, statementRequestSchema } from "../src/monthly_statement.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the sample.");

const recipient = process.env.STATEMENT_RECIPIENT;
if (!recipient) throw new Error("Set STATEMENT_RECIPIENT to an email address you control.");

const input = statementRequestSchema.parse({
  customer: { name: "Harbor Legal", email: recipient },
  period: { label: "September 2026", start: "2026-09-01", end: "2026-09-30" },
  matters: [
    {
      matterId: "MAT-1042",
      title: "Trademark renewal",
      intakeAt: "2026-09-03T09:15:00.000Z",
      signedDocument: { deliveredAt: "2026-09-25T16:40:00.000Z" },
      deadline: "2026-10-05",
      completed: false,
    },
  ],
});

const result = await sendMonthlyStatement(
  new InfraiClient(apiKey),
  input,
  "2026-10-01T09:00:00.000Z",
);
console.log(JSON.stringify(result, null, 2));

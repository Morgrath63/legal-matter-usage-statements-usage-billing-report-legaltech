import assert from "node:assert/strict";
import test from "node:test";
import { decideMatterFollowUps, statementRequestSchema } from "../src/monthly_statement.js";

test("flags only an open, delivered matter inside the seven-day deadline window", () => {
  const input = statementRequestSchema.parse({
    customer: { name: "Harbor Legal", email: "ops@example.com" },
    period: { label: "September 2026", start: "2026-09-01", end: "2026-09-30" },
    matters: [
      {
        matterId: "MAT-DUE",
        title: "Renewal",
        intakeAt: "2026-09-01T10:00:00.000Z",
        signedDocument: { deliveredAt: "2026-09-28T10:00:00.000Z" },
        deadline: "2026-10-05",
        completed: false,
      },
      {
        matterId: "MAT-PENDING",
        title: "Filing",
        intakeAt: "2026-09-02T10:00:00.000Z",
        signedDocument: null,
        deadline: "2026-10-03",
        completed: false,
      },
      {
        matterId: "MAT-CLOSED",
        title: "Review",
        intakeAt: "2026-09-03T10:00:00.000Z",
        signedDocument: { deliveredAt: "2026-09-20T10:00:00.000Z" },
        deadline: "2026-10-04",
        completed: true,
      },
    ],
  });

  const decisions = decideMatterFollowUps(input, "2026-10-01T18:00:00.000Z");

  assert.deepEqual(
    decisions.filter((decision) => decision.deadlineFollowUp === "due").map((decision) => decision.matterId),
    ["MAT-DUE"],
  );
  assert.equal(decisions[1]?.signedDelivery, "pending");
  assert.equal(decisions[2]?.status, "completed");
});

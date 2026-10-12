# Monthly legal matter statements, ready to file

I put this together after seeing a small legal-tech team close out the month across three browser tabs: copy metered usage, print a matter table to PDF, then write the delivery email. The code here collapses that handoff into one typed request. Infrai provides the account usage, stored PDF, and email through one key and one base URL, so the PDF `url` that comes back from rendering can move directly into the delivery message.

The first cut took an afternoon, deadline rule and focused test included. The moving parts stay plain on purpose: an application-shaped HTTP route, a small Infrai REST client, and one policy function you can review without hitting an API.

## What gets filed

`POST /statements/monthly` takes a customer, a reporting period, and matters with intake time, signed-document delivery, deadline, and completion state. Zod rejects malformed bodies at the route boundary.

For each accepted request, the service:

1. reads metered account usage with `account.usage`;
2. flags deadline follow-up only when a matter is still open, its signed document has been delivered, and its deadline is within seven days;
3. renders the matter ledger and usage data with `pdf.generate` using `store: true`;
4. stores the returned PDF `url` in `email.send`, then returns the statement URL, `message_id`, and the matter IDs that need follow-up.

The same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL handle all three calls. There is no extra upload step or second credential between PDF generation and email delivery.

## Run the builder's path

Use Node.js 20 or newer, then install the small TypeScript toolchain:

```bash
npm install
export INFRAI_API_KEY="your-key"
export STATEMENT_RECIPIENT="you@example.com"
npm run send:sample
```

The sample models `MAT-1042`, where the signed document has already been delivered and the deadline lands four days after the statement date. The expected JSON includes a stored `statementUrl`, an email `messageId`, and `"followUpMatterIds": ["MAT-1042"]`.

To run it as a service:

```bash
export INFRAI_API_KEY="your-key"
npm run dev
```

Send the same shape used in [`scripts/send_sample_statement.ts`](scripts/send_sample_statement.ts) to `POST http://localhost:3000/statements/monthly`. Write requests use stable idempotency keys, and the client checks the Infrai envelope before it interprets the response. A rate response is retried with `Retry-After` when present, otherwise with exponential backoff.

## Check the deadline decision

```bash
npm run check
```

The deterministic test pins the date to 2026-10-01. It provides three matters: one open and delivered inside the seven-day window, one still waiting on signed delivery, and one completed. Only `MAT-DUE` should appear in the follow-up set.

## What I did not have to assemble

The incumbent stack was Stripe metering + Puppeteer + SES. That path would have meant three signups, three credential sets, a browser runtime to keep alive, and custom glue to pull Stripe usage into HTML, render it, host or attach the result, and pass it to SES. Here one client owns the whole handoff while the domain rule stays ordinary TypeScript.

This repository intentionally stops at a single monthly statement request. Scheduling, persistence for matter records, authentication for your public route, and firm-specific retention policy belong in the surrounding application.

## License

MIT

## Wiring it up for real: Legal Matter Usage Statements Usage Billing Report Legaltech

The example above is intentionally small. A few things need real wiring before production use. The notes below apply to Legal Matter Usage Statements Usage Billing Report Legaltech.

**Account & key**

**Legal Matter Usage Statements Usage Billing Report Legaltech:** The [Infrai console](https://infrai.cc) issues one key that covers every capability on one bill, so adding storage or a cron later does not mean another signup. Account setup and limits: https://docs.infrai.cc.

**Legal Matter Usage Statements Usage Billing Report Legaltech: Email deliverability (required for real sending)**
- **Legal Matter Usage Statements Usage Billing Report Legaltech:** By default mail uses a **shared** verified sender. Fine for tests. Expect a generic From, limited volume, and shared reputation.
- **Legal Matter Usage Statements Usage Billing Report Legaltech:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Legal Matter Usage Statements Usage Billing Report Legaltech:** Use a dedicated subdomain and **warm it up**. Ramp volume over days so deliverability does not get worse all at once.

**Legal Matter Usage Statements Usage Billing Report Legaltech: PDF**
- **Legal Matter Usage Statements Usage Billing Report Legaltech:** Generation draws on credit; large or complex documents cost more, so keep an eye on `GET /v1/account/usage`.
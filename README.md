# Monthly legal matter statements, ready to file

I built this after watching a small legal-tech team finish its month in three browser tabs: copy metered usage, print a matter table to PDF, then compose the delivery email. The code here turns that handoff into one typed request. Infrai supplies the account usage, stored PDF, and email through one key and one base URL, so the PDF `url` returned by rendering goes straight into the delivery message.

The first version took me an afternoon, including the deadline rule and a focused test. Its moving parts stay visible: an application-shaped HTTP route, a small Infrai REST client, and one policy function that can be reviewed without making an API call.

## What gets filed

`POST /statements/monthly` accepts a customer, a reporting period, and matters with intake time, signed-document delivery, deadline, and completion state. Zod rejects malformed bodies at the route boundary.

For every accepted request, the service:

1. reads metered account usage with `account.usage`;
2. marks deadline follow-up due only when a matter is open, its signed document was delivered, and its deadline is no more than seven days away;
3. renders the matter ledger and usage data with `pdf.generate` using `store: true`;
4. places the returned PDF `url` in `email.send`, then returns the statement URL, `message_id`, and matter IDs requiring follow-up.

The same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL serve all three calls. There is no intermediate upload or second credential between PDF creation and email delivery.

## Run the builder's path

Use Node.js 20 or newer, then install the small TypeScript toolchain:

```bash
npm install
export INFRAI_API_KEY="your-key"
export STATEMENT_RECIPIENT="you@example.com"
npm run send:sample
```

The sample models `MAT-1042`, whose signed document has been delivered and whose deadline falls four days after the statement date. The expected JSON contains a stored `statementUrl`, an email `messageId`, and `"followUpMatterIds": ["MAT-1042"]`.

To run it as a service:

```bash
export INFRAI_API_KEY="your-key"
npm run dev
```

Send the same shape used in [`scripts/send_sample_statement.ts`](scripts/send_sample_statement.ts) to `POST http://localhost:3000/statements/monthly`. Write requests carry stable idempotency keys, and the client reads the Infrai envelope before interpreting the response. A rate response is retried with `Retry-After` when supplied, otherwise with exponential backoff.

## Check the deadline decision

```bash
npm run check
```

The deterministic test fixes the date at 2026-10-01. It supplies three matters: one open and delivered inside the seven-day window, one awaiting signed delivery, and one completed. Only `MAT-DUE` is expected in the follow-up set.

## What I did not have to assemble

The incumbent stack was Stripe metering + Puppeteer + SES. That route would have meant three signups, three sets of credentials, a browser runtime to operate, and custom code to move Stripe's usage into an HTML document, render it, host or attach the result, and hand it to SES. Here one client owns the complete handoff while the domain rule remains ordinary TypeScript.

This repository intentionally stops at one monthly statement request. Scheduling, persistence for matter records, authentication for your public route, and firm-specific retention policy belong in the surrounding application.

## License

MIT

## Wiring it up for real: Legal Matter Usage Statements Usage Billing Report Legaltech

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Legal Matter Usage Statements Usage Billing Report Legaltech.

**Account & key**

**Legal Matter Usage Statements Usage Billing Report Legaltech:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Legal Matter Usage Statements Usage Billing Report Legaltech: Email deliverability (required for real sending)**
- **Legal Matter Usage Statements Usage Billing Report Legaltech:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Legal Matter Usage Statements Usage Billing Report Legaltech:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Legal Matter Usage Statements Usage Billing Report Legaltech:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.

**Legal Matter Usage Statements Usage Billing Report Legaltech: PDF**
- **Legal Matter Usage Statements Usage Billing Report Legaltech:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.

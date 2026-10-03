import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { InfraiClient, InfraiError } from "./infrai_client.js";
import { sendMonthlyStatement, statementRequestSchema } from "./monthly_statement.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service.");

const infrai = new InfraiClient(apiKey);
const port = Number(process.env.PORT ?? "3000");

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/statements/monthly") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const payload = await readJson(request);
    const input = statementRequestSchema.parse(payload);
    const result = await sendMonthlyStatement(infrai, input);
    sendJson(response, 201, result);
  } catch (error) {
    if (error instanceof ZodError) {
      sendJson(response, 400, { error: "Invalid statement request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.code, detail: error.detail });
      return;
    }
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Invalid request" });
  }
}).listen(port, () => {
  console.log(`Statement service listening on http://localhost:${port}`);
});

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

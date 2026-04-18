import { createServer } from "node:http";
import { createIntentGate, createPolicy, gateOpenAIToolCall } from "@pallattu/aeg-intent-gate";

const gate = createIntentGate({
  agent: {
    agentId: "node-agent",
    capabilities: ["email.send", "refund.create", "ticket.create"],
  },
  policies: [
    createPolicy({
      name: "review-side-effects",
      match: (intent) => ["email.send", "refund.create"].includes(intent.type),
      evaluate: () => ({
        outcome: "requires_approval",
        reason: "Side-effecting tool calls require human review.",
      }),
    }),
  ],
});

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/tool-calls/openai") {
    return sendJson(response, 404, { error: "Not found." });
  }

  try {
    const body = await readJson(request);
    const result = await gateOpenAIToolCall(gate, body.toolCall, {
      target: body.target ?? "production",
    });

    if (result.command) {
      return sendJson(response, 200, {
        status: "execute",
        command: result.command,
      });
    }

    return sendJson(response, result.decision.outcome === "blocked" ? 403 : 202, {
      status: result.decision.outcome,
      intentId: result.intent.id,
      reason: result.decision.reason,
    });
  } catch (error) {
    return sendJson(response, 400, {
      error: error instanceof Error ? error.message : "Invalid request.",
    });
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => {
  console.log(`approval gate listening on http://localhost:${process.env.PORT ?? 3000}`);
});

function readJson(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

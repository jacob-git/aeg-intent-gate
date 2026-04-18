import express from "express";
import { createIntentGate, createPolicy, gateOpenAIToolCall } from "@pallattu/aeg-intent-gate";

const app = express();
app.use(express.json());

const gate = createIntentGate({
  agent: {
    agentId: "express-agent",
    capabilities: ["email.send", "refund.create", "user.delete"],
  },
  policies: [
    createPolicy({
      name: "block-user-delete",
      match: (intent) => intent.type === "user.delete",
      evaluate: () => ({
        outcome: "blocked",
        reason: "User deletion is not allowed from agent tool calls.",
      }),
    }),
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

const pending = new Map<string, Awaited<ReturnType<typeof gateOpenAIToolCall>>>();

app.post("/tool-calls/openai", async (request, response) => {
  const result = await gateOpenAIToolCall(gate, request.body);

  if (result.decision.outcome === "requires_approval") {
    pending.set(result.intent.id, result);
  }

  if (result.command) {
    return response.json({ status: "execute", command: result.command });
  }

  return response.json({
    status: result.decision.outcome,
    reason: result.decision.reason,
    intentId: result.intent.id,
  });
});

app.post("/approvals/:intentId", async (request, response) => {
  const result = pending.get(request.params.intentId);
  if (!result) return response.status(404).json({ error: "Unknown pending intent." });

  const approved = await gate.approveIntent(result.intent, result.decision, {
    approvedBy: request.body?.approvedBy ?? "reviewer",
    reason: request.body?.reason ?? "Approved from Express endpoint.",
  });
  pending.delete(result.intent.id);

  return response.json({
    status: "execute",
    command: gate.toCommand(result.intent, approved),
  });
});

export { app };

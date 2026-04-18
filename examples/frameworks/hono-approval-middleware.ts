import { Hono } from "hono";
import { createIntentGate, createPolicy, gateOpenAIToolCall } from "@pallattu/aeg-intent-gate";

const gate = createIntentGate({
  agent: {
    agentId: "hono-agent",
    capabilities: ["email.send", "refund.create", "user.delete"],
  },
  policies: [
    createPolicy({
      name: "block-user-delete",
      match: (intent) => intent.type === "user.delete",
      evaluate: () => ({
        outcome: "blocked",
        reason: "Deleting users is not allowed from this endpoint.",
      }),
    }),
    createPolicy({
      name: "review-side-effects",
      match: (intent) => ["email.send", "refund.create"].includes(intent.type),
      evaluate: () => ({
        outcome: "requires_approval",
        reason: "Side-effecting tool calls require review.",
      }),
    }),
  ],
});

const pending = new Map<string, Awaited<ReturnType<typeof gateOpenAIToolCall>>>();
export const app = new Hono();

app.post("/tool-calls/openai", async (c) => {
  const toolCall = await c.req.json();
  const result = await gateOpenAIToolCall(gate, toolCall);

  if (result.decision.outcome === "requires_approval") {
    pending.set(result.intent.id, result);
  }

  if (result.command) {
    return c.json({ status: "execute", command: result.command });
  }

  return c.json({
    status: result.decision.outcome,
    reason: result.decision.reason,
    intentId: result.intent.id,
  });
});

app.post("/approvals/:intentId", async (c) => {
  const intentId = c.req.param("intentId");
  const result = pending.get(intentId);
  if (!result) return c.json({ error: "Unknown pending intent." }, 404);

  const approved = await gate.approveIntent(result.intent, result.decision, {
    approvedBy: "reviewer",
    reason: "Approved from Hono endpoint.",
  });
  pending.delete(intentId);

  return c.json({
    status: "execute",
    command: gate.toCommand(result.intent, approved),
  });
});

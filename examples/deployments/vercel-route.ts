import { createIntentGate, createPolicy, gateOpenAIToolCall } from "@pallattu/aeg-intent-gate";

const gate = createIntentGate({
  agent: {
    agentId: "vercel-agent",
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

export async function POST(request: Request) {
  const body = await request.json();
  const result = await gateOpenAIToolCall(gate, body.toolCall, {
    target: body.target ?? "production",
  });

  if (result.command) {
    return Response.json({
      status: "execute",
      command: result.command,
    });
  }

  return Response.json({
    status: result.decision.outcome,
    intentId: result.intent.id,
    reason: result.decision.reason,
  }, {
    status: result.decision.outcome === "blocked" ? 403 : 202,
  });
}

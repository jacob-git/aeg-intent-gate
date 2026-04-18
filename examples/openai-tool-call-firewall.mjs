import { createIntentGate, createPolicy, gateOpenAIToolCall } from "../dist/index.js";

const gate = createIntentGate({
  agent: {
    agentId: "openai_support_agent",
    capabilities: ["ticket.create", "email.send", "refund.create"],
  },
  policies: [
    createPolicy({
      name: "emails-need-review",
      match: (intent) => intent.type === "email.send",
      evaluate: () => ({
        outcome: "requires_approval",
        reason: "Outbound email needs human review.",
      }),
    }),
    createPolicy({
      name: "large-refunds-need-review",
      match: (intent) => intent.type === "refund.create" && intent.metadata.args.amount > 100,
      evaluate: () => ({
        outcome: "requires_approval",
        reason: "Refunds above $100 require approval.",
      }),
    }),
  ],
});

// Shape returned by OpenAI Responses API function calling.
const toolCall = {
  id: "fc_123",
  call_id: "call_123",
  type: "function_call",
  name: "email.send",
  arguments: JSON.stringify({
    to: "customer@example.com",
    subject: "Refund update",
    body: "Your refund has been processed.",
  }),
};

const result = await gateOpenAIToolCall(gate, toolCall, {
  target: "postmark",
});

let command = result.command;
if (result.decision.outcome === "requires_approval") {
  const approved = await gate.approveIntent(result.intent, result.decision, {
    approvedBy: "human_operator",
    reason: "Message reviewed.",
  });
  command = gate.toCommand(result.intent, approved);
}

console.log(JSON.stringify({
  decision: result.decision,
  command,
}, null, 2));

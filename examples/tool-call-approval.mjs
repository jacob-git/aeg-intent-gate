import { createIntentGate, createPolicy, gateToolCall } from "../dist/index.js";

const gate = createIntentGate({
  agent: {
    agentId: "support_agent",
    capabilities: ["ticket.read", "refund.create", "email.send"],
  },
  policies: [
    createPolicy({
      name: "large-refunds-need-human",
      match: (intent) => intent.type === "refund.create" && intent.metadata.args.amount > 100,
      evaluate: () => ({
        outcome: "requires_approval",
        reason: "Refunds above $100 require human approval.",
      }),
    }),
    createPolicy({
      name: "block-user-deletion",
      match: (intent) => intent.type === "user.delete",
      evaluate: () => ({
        outcome: "blocked",
        reason: "Agents cannot delete users.",
      }),
    }),
  ],
});

const result = await gateToolCall(gate, {
  tool: "refund.create",
  target: "stripe",
  args: {
    customerId: "cus_123",
    amount: 250,
    reason: "Duplicate charge.",
  },
});

let command = result.command;
if (result.decision.outcome === "requires_approval") {
  const approved = await gate.approveIntent(result.intent, result.decision, {
    approvedBy: "human_operator",
    reason: "Customer history reviewed.",
    metadata: { ticket: "SUP-431" },
  });
  command = gate.toCommand(result.intent, approved);
}

console.log(JSON.stringify({
  decision: result.decision,
  command,
}, null, 2));

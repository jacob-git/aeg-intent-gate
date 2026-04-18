import { createIntentGate, createPolicy, gateAnthropicToolUse } from "../dist/index.js";

const gate = createIntentGate({
  agent: {
    agentId: "claude_ops_agent",
    capabilities: ["deploy.preview", "service.restart", "incident.create"],
  },
  policies: [
    createPolicy({
      name: "restarts-need-human",
      match: (intent) => intent.type === "service.restart",
      evaluate: () => ({
        outcome: "requires_approval",
        reason: "Service restarts require human approval.",
      }),
    }),
  ],
});

// Shape returned by Anthropic tool use content blocks.
const toolUse = {
  id: "toolu_123",
  type: "tool_use",
  name: "service.restart",
  input: {
    service: "api",
    region: "us-central1",
  },
};

const result = await gateAnthropicToolUse(gate, toolUse, {
  target: "production",
});

console.log(JSON.stringify({
  status: result.decision.outcome,
  reason: result.decision.reason,
  intentId: result.intent.id,
  command: result.command,
}, null, 2));

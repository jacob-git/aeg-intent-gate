#!/usr/bin/env node
import { createIntentGate, createPolicy } from "./gate.js";
import { gateToolCall, type ToolCall } from "./tool-call.js";

const gate = createIntentGate({
  agent: {
    agentId: "demo_agent",
    capabilities: ["email.send", "refund.create", "shell.exec"],
  },
  policies: [
    createPolicy({
      name: "approve-ops-email",
      match: (intent) => intent.type === "email.send"
        && (intent.metadata?.args as Record<string, unknown> | undefined)?.to === "ops@example.com",
      evaluate: () => ({
        outcome: "approved",
        reason: "Ops notification is allowed.",
      }),
    }),
    createPolicy({
      name: "block-dangerous-shell",
      match: (intent) => intent.type === "shell.exec"
        && /rm\s+-rf|shutdown|mkfs/.test(String((intent.metadata?.args as Record<string, unknown> | undefined)?.command)),
      evaluate: () => ({
        outcome: "blocked",
        reason: "Dangerous shell command blocked.",
      }),
    }),
    createPolicy({
      name: "large-refunds-need-human",
      match: (intent) => intent.type === "refund.create"
        && Number((intent.metadata?.args as Record<string, unknown> | undefined)?.amount) > 100,
      evaluate: () => ({
        outcome: "requires_approval",
        reason: "Refunds above $100 require human approval.",
      }),
    }),
  ],
});

const scenarios: Array<{ label: string; call: ToolCall }> = [
  {
    label: "safe email",
    call: {
      tool: "email.send",
      target: "postmark",
      args: { to: "ops@example.com", subject: "Deploy finished" },
    },
  },
  {
    label: "large refund",
    call: {
      tool: "refund.create",
      target: "stripe",
      args: { customerId: "cus_123", amount: 250 },
    },
  },
  {
    label: "dangerous shell",
    call: {
      tool: "shell.exec",
      target: "local-dev",
      args: { command: "rm -rf /tmp/demo" },
    },
  },
];

console.log("aeg-intent-gate demo: AI tool calls must pass policy before execution\n");

for (const scenario of scenarios) {
  const result = await gateToolCall(gate, scenario.call);
  console.log(`${scenario.label}: ${result.decision.outcome}`);
  if (result.decision.reason) console.log(`  reason: ${result.decision.reason}`);
  if (result.command) console.log(`  command: ${result.command.type} -> ${result.command.target}`);
}

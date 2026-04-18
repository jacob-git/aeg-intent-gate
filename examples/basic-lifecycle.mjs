import { createIntentGate, createPolicy } from "../dist/index.js";

const events = [];

const gate = createIntentGate({
  agent: {
    agentId: "agent_docs",
    capabilities: ["logs.read"],
  },
  fallbackDecision: { outcome: "approved" },
  onEvent: (event) => {
    events.push({
      type: event.type,
      status: event.status,
      intentId: event.intentId,
    });
  },
  policies: [
    createPolicy({
      name: "block-database-drop",
      match: (intent) => intent.type === "database.drop",
      evaluate: () => ({
        outcome: "blocked",
        reason: "Dropping databases is never executable from this gate.",
      }),
    }),
    createPolicy({
      name: "restart-requires-approval",
      match: (intent) => intent.type === "service.restart",
      evaluate: () => ({ outcome: "requires_approval" }),
    }),
  ],
});

const proposed = await gate.proposeIntent({
  type: "logs.read",
  target: "api",
  requestedCapabilities: ["logs.read"],
  metadata: {
    actor: "example-agent",
    source: "basic-lifecycle",
  },
});

const decision = await gate.evaluateIntent(proposed);
const command = decision.outcome === "approved"
  ? gate.toCommand(proposed, decision)
  : undefined;

console.log(JSON.stringify({
  intent: {
    id: proposed.id,
    status: proposed.status,
    type: proposed.type,
    target: proposed.target,
  },
  decision,
  command,
  events,
}, null, 2));

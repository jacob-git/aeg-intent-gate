import { createIntentGate, createPolicy } from "../dist/index.js";

const events = [];

const gate = createIntentGate({
  agent: {
    agentId: "agent_docs",
    capabilities: ["logs.read", "service.restart"],
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
  type: "service.restart",
  target: "api",
  requestedCapabilities: ["service.restart"],
  metadata: {
    actor: "example-agent",
    source: "basic-lifecycle",
  },
});

const decision = await gate.evaluateIntent(proposed);
const executableDecision = decision.outcome === "requires_approval"
  ? await gate.approveIntent(proposed, decision, {
      approvedBy: "human_operator",
      reason: "Approved during the maintenance window.",
      metadata: { ticket: "OPS-123" },
    })
  : decision;
const command = executableDecision.outcome === "approved"
  ? gate.toCommand(proposed, executableDecision)
  : undefined;

console.log(JSON.stringify({
  intent: {
    id: proposed.id,
    status: proposed.status,
    type: proposed.type,
    target: proposed.target,
  },
  decision,
  executableDecision,
  command,
  events,
}, null, 2));

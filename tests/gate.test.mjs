import assert from "node:assert/strict";
import test from "node:test";
import { createIntentGate, createPolicy } from "../dist/index.js";

const baseAgent = {
  agentId: "agent_1",
  capabilities: ["logs.read", "service.restart"],
};

const logsIntent = (overrides = {}) => ({
  type: "logs.read",
  target: "api",
  requestedCapabilities: ["logs.read"],
  metadata: { actor: "agent", unsafe: undefined, nested: { keep: true } },
  ...overrides,
});

test("proposeIntent assigns an id, proposed status, and emits an event", async () => {
  const events = [];
  const gate = createIntentGate({
    agent: baseAgent,
    policies: [],
    onEvent: (event) => events.push(event),
  });

  const proposed = await gate.proposeIntent(logsIntent());

  assert.equal(proposed.status, "proposed");
  assert.match(proposed.id, /^intent_/);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "IntentProposed");
  assert.equal(events[0].status, "proposed");
  assert.equal(events[0].intentId, proposed.id);
});

test("evaluateIntent blocks missing capabilities before custom policies", async () => {
  const gate = createIntentGate({
    agent: { agentId: "agent_1", capabilities: ["logs.read"] },
    policies: [
      createPolicy({
        match: () => true,
        evaluate: () => ({ outcome: "approved" }),
      }),
    ],
  });

  const proposed = await gate.proposeIntent(logsIntent({
    type: "service.restart",
    requestedCapabilities: ["service.restart"],
  }));
  const decision = await gate.evaluateIntent(proposed);

  assert.equal(decision.outcome, "blocked");
  assert.equal(proposed.status, "blocked");
  assert.deepEqual(decision.metadata?.missingCapabilities, ["service.restart"]);
});

test("first matching policy wins and updates lifecycle status", async () => {
  const gate = createIntentGate({
    agent: baseAgent,
    policies: [
      createPolicy({
        name: "first",
        match: (intent) => intent.type === "logs.read",
        evaluate: () => ({ outcome: "requires_approval" }),
      }),
      createPolicy({
        name: "second",
        match: () => true,
        evaluate: () => ({ outcome: "approved" }),
      }),
    ],
  });

  const proposed = await gate.proposeIntent(logsIntent());
  const decision = await gate.evaluateIntent(proposed);

  assert.equal(decision.outcome, "requires_approval");
  assert.equal(proposed.status, "requires_approval");
});

test("fallback decision applies when no policy matches", async () => {
  const gate = createIntentGate({
    agent: baseAgent,
    fallbackDecision: { outcome: "approved" },
    policies: [],
  });

  const proposed = await gate.proposeIntent(logsIntent());
  const decision = await gate.evaluateIntent(proposed);

  assert.equal(decision.outcome, "approved");
  assert.equal(proposed.status, "approved");
});

test("events are emitted in lifecycle order", async () => {
  const events = [];
  const gate = createIntentGate({
    agent: baseAgent,
    policies: [],
    onEvent: (event) => events.push(event),
  });

  const proposed = await gate.proposeIntent(logsIntent());
  await gate.evaluateIntent(proposed);

  assert.deepEqual(events.map((event) => event.type), [
    "IntentProposed",
    "IntentEvaluated",
    "IntentApproved",
  ]);
  assert.deepEqual(events.map((event) => event.status), [
    "proposed",
    "evaluated",
    "approved",
  ]);
});

test("evaluateIntent rejects intents that already left proposed status", async () => {
  const gate = createIntentGate({ agent: baseAgent, policies: [] });
  const proposed = await gate.proposeIntent(logsIntent());

  await gate.evaluateIntent(proposed);
  await assert.rejects(() => gate.evaluateIntent(proposed), /Cannot evaluate intent with approved status/);
});

test("toCommand creates sanitized commands for approved evaluated intents", async () => {
  const gate = createIntentGate({ agent: baseAgent, policies: [] });
  const proposed = await gate.proposeIntent(logsIntent({
    metadata: {
      actor: "agent",
      count: Number.POSITIVE_INFINITY,
      fn: () => undefined,
      nested: { keep: true, drop: undefined },
      list: ["ok", undefined, 1],
    },
  }));
  const decision = await gate.evaluateIntent(proposed);
  const command = gate.toCommand(proposed, decision);

  assert.equal(command.intentId, proposed.id);
  assert.equal(command.agentId, baseAgent.agentId);
  assert.equal(command.type, "logs.read");
  assert.deepEqual(command.payload, {
    actor: "agent",
    nested: { keep: true },
    list: ["ok", 1],
  });
});

test("toCommand rejects blocked decisions", async () => {
  const gate = createIntentGate({
    agent: { agentId: "agent_1", capabilities: [] },
    policies: [],
  });
  const proposed = await gate.proposeIntent(logsIntent());
  const decision = await gate.evaluateIntent(proposed);

  await assert.rejects(async () => gate.toCommand(proposed, decision), /Cannot create command for blocked intent/);
});

test("toCommand rejects forged decisions and mismatched intents", async () => {
  const gate = createIntentGate({ agent: baseAgent, policies: [] });
  const proposed = await gate.proposeIntent(logsIntent());
  const decision = await gate.evaluateIntent(proposed);
  const other = await gate.proposeIntent(logsIntent({ id: "intent_other" }));

  assert.throws(() => gate.toCommand(proposed, { outcome: "approved" }), /unevaluated decision/);
  assert.throws(() => gate.toCommand(other, decision), /different intent/);
});

test("approveIntent converts approval-required decisions into executable approvals", async () => {
  const events = [];
  const gate = createIntentGate({
    agent: baseAgent,
    policies: [
      createPolicy({
        match: (intent) => intent.type === "service.restart",
        evaluate: () => ({ outcome: "requires_approval" }),
      }),
    ],
    onEvent: (event) => events.push(event),
  });

  const proposed = await gate.proposeIntent(logsIntent({
    type: "service.restart",
    requestedCapabilities: ["service.restart"],
  }));
  const decision = await gate.evaluateIntent(proposed);
  const approved = await gate.approveIntent(proposed, decision, {
    approvedBy: "human_1",
    reason: "Maintenance window.",
    metadata: { ticket: "OPS-123" },
  });
  const command = gate.toCommand(proposed, approved);

  assert.equal(approved.outcome, "approved");
  assert.equal(approved.reason, "Maintenance window.");
  assert.deepEqual(approved.metadata, { ticket: "OPS-123", approvedBy: "human_1" });
  assert.equal(proposed.status, "approved");
  assert.equal(command.type, "service.restart");
  assert.deepEqual(events.map((event) => event.type), [
    "IntentProposed",
    "IntentEvaluated",
    "ApprovalRequired",
    "IntentApprovalGranted",
  ]);
});

test("approveIntent rejects blocked, approved, forged, and mismatched decisions", async () => {
  const gate = createIntentGate({
    agent: baseAgent,
    policies: [
      createPolicy({
        match: (intent) => intent.type === "service.restart",
        evaluate: () => ({ outcome: "requires_approval" }),
      }),
    ],
  });
  const requiresApproval = await gate.proposeIntent(logsIntent({
    type: "service.restart",
    requestedCapabilities: ["service.restart"],
  }));
  const decision = await gate.evaluateIntent(requiresApproval);
  const approvedIntent = await gate.proposeIntent(logsIntent({ id: "intent_approved" }));
  const approvedDecision = await gate.evaluateIntent(approvedIntent);
  const blockedIntent = await gate.proposeIntent(logsIntent({
    id: "intent_blocked",
    type: "database.drop",
    requestedCapabilities: ["database.drop"],
  }));
  const blockedDecision = await gate.evaluateIntent(blockedIntent);
  const other = await gate.proposeIntent(logsIntent({
    id: "intent_other",
    type: "service.restart",
    requestedCapabilities: ["service.restart"],
  }));

  await assert.rejects(
    () => gate.approveIntent(requiresApproval, { outcome: "requires_approval" }, { approvedBy: "human_1" }),
    /unevaluated decision/,
  );
  await assert.rejects(
    () => gate.approveIntent(other, decision, { approvedBy: "human_1" }),
    /different intent/,
  );
  await assert.rejects(
    () => gate.approveIntent(approvedIntent, approvedDecision, { approvedBy: "human_1" }),
    /approved decision/,
  );
  await assert.rejects(
    () => gate.approveIntent(blockedIntent, blockedDecision, { approvedBy: "human_1" }),
    /blocked decision/,
  );
});

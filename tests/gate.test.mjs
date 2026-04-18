import assert from "node:assert/strict";
import test from "node:test";
import {
  createIntentGate,
  createPolicy,
  gateAnthropicToolUse,
  gateMcpToolCall,
  gateOpenAIToolCall,
  gateToolCall,
} from "../dist/index.js";

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

test("fallback decision requires approval by default when no policy matches", async () => {
  const gate = createIntentGate({
    agent: baseAgent,
    policies: [],
  });

  const proposed = await gate.proposeIntent(logsIntent());
  const decision = await gate.evaluateIntent(proposed);

  assert.equal(decision.outcome, "requires_approval");
  assert.equal(decision.reason, "No policy matched this intent.");
  assert.equal(proposed.status, "requires_approval");
});

test("events are emitted in lifecycle order", async () => {
  const events = [];
  const gate = createIntentGate({
    agent: baseAgent,
    fallbackDecision: { outcome: "approved" },
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
  const gate = createIntentGate({
    agent: baseAgent,
    fallbackDecision: { outcome: "approved" },
    policies: [],
  });
  const proposed = await gate.proposeIntent(logsIntent());

  await gate.evaluateIntent(proposed);
  await assert.rejects(() => gate.evaluateIntent(proposed), /Cannot evaluate intent with approved status/);
});

test("toCommand creates sanitized commands for approved evaluated intents", async () => {
  const gate = createIntentGate({
    agent: baseAgent,
    fallbackDecision: { outcome: "approved" },
    policies: [],
  });
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

test("toCommand uses the evaluated payload snapshot after intent metadata changes", async () => {
  let proposed;
  const gate = createIntentGate({
    agent: baseAgent,
    fallbackDecision: { outcome: "approved" },
    policies: [],
    onEvent: (event) => {
      if (event.type === "IntentApproved") {
        proposed.metadata.actor = "event-mutated";
      }
    },
  });
  proposed = await gate.proposeIntent(logsIntent({
    metadata: {
      actor: "agent",
      nested: { keep: true },
      list: ["ok"],
    },
  }));
  const decision = await gate.evaluateIntent(proposed);

  proposed.metadata.actor = "mutated";
  proposed.metadata.nested.keep = false;
  proposed.metadata.list.push("mutated");

  const command = gate.toCommand(proposed, decision);
  command.payload.actor = "caller-mutated-command";
  const secondCommand = gate.toCommand(proposed, decision);

  assert.deepEqual(command.payload, {
    actor: "caller-mutated-command",
    nested: { keep: true },
    list: ["ok"],
  });
  assert.deepEqual(secondCommand.payload, {
    actor: "agent",
    nested: { keep: true },
    list: ["ok"],
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
  const gate = createIntentGate({
    agent: baseAgent,
    fallbackDecision: { outcome: "approved" },
    policies: [],
  });
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
        match: (intent) => intent.type === "logs.read",
        evaluate: () => ({ outcome: "approved" }),
      }),
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
        match: (intent) => intent.type === "logs.read",
        evaluate: () => ({ outcome: "approved" }),
      }),
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

test("invalid decisions are rejected at runtime", async () => {
  assert.throws(
    () => createIntentGate({
      agent: baseAgent,
      fallbackDecision: { outcome: "maybe" },
      policies: [],
    }),
    /Decision\.outcome/,
  );

  const gate = createIntentGate({
    agent: baseAgent,
    policies: [
      createPolicy({
        match: () => true,
        evaluate: () => ({ outcome: "maybe" }),
      }),
    ],
  });
  const proposed = await gate.proposeIntent(logsIntent());

  await assert.rejects(() => gate.evaluateIntent(proposed), /Decision\.outcome/);
  assert.equal(proposed.status, "proposed");
});

test("evaluateIntent leaves status unchanged when final event emission fails", async () => {
  let failFinalEvent = true;
  const gate = createIntentGate({
    agent: baseAgent,
    fallbackDecision: { outcome: "approved" },
    policies: [],
    onEvent: (event) => {
      if (failFinalEvent && event.type === "IntentApproved") {
        failFinalEvent = false;
        throw new Error("event sink unavailable");
      }
    },
  });
  const proposed = await gate.proposeIntent(logsIntent());

  await assert.rejects(() => gate.evaluateIntent(proposed), /event sink unavailable/);
  assert.equal(proposed.status, "proposed");

  const decision = await gate.evaluateIntent(proposed);
  assert.equal(decision.outcome, "approved");
  assert.equal(proposed.status, "approved");
});

test("approveIntent leaves approval-required status unchanged when event emission fails", async () => {
  let failApprovalEvent = true;
  const gate = createIntentGate({
    agent: baseAgent,
    policies: [
      createPolicy({
        match: () => true,
        evaluate: () => "requires_approval",
      }),
    ],
    onEvent: (event) => {
      if (failApprovalEvent && event.type === "IntentApprovalGranted") {
        failApprovalEvent = false;
        throw new Error("approval event sink unavailable");
      }
    },
  });
  const proposed = await gate.proposeIntent(logsIntent());
  const decision = await gate.evaluateIntent(proposed);

  await assert.rejects(
    () => gate.approveIntent(proposed, decision, { approvedBy: "human_1" }),
    /approval event sink unavailable/,
  );
  assert.equal(proposed.status, "requires_approval");

  const approved = await gate.approveIntent(proposed, decision, { approvedBy: "human_1" });
  assert.equal(approved.outcome, "approved");
  assert.equal(proposed.status, "approved");
});

test("gateToolCall gates common tool call shapes", async () => {
  const gate = createIntentGate({
    agent: {
      agentId: "support_agent",
      capabilities: ["refund.create"],
    },
    policies: [
      createPolicy({
        name: "small-refunds",
        match: (intent) => intent.type === "refund.create" && intent.metadata?.args?.amount <= 100,
        evaluate: () => "approved",
      }),
      createPolicy({
        name: "large-refunds",
        match: (intent) => intent.type === "refund.create",
        evaluate: () => "requires_approval",
      }),
    ],
  });

  const smallRefund = await gateToolCall(gate, {
    tool: "refund.create",
    target: "stripe",
    args: { customerId: "cus_123", amount: 75 },
  });
  const largeRefund = await gateToolCall(gate, {
    tool: "refund.create",
    target: "stripe",
    args: { customerId: "cus_123", amount: 500 },
  });

  assert.equal(smallRefund.decision.outcome, "approved");
  assert.equal(smallRefund.command?.type, "refund.create");
  assert.deepEqual(smallRefund.command?.payload, {
    args: { customerId: "cus_123", amount: 75 },
  });
  assert.equal(largeRefund.decision.outcome, "requires_approval");
  assert.equal(largeRefund.command, undefined);
});

test("gateToolCall defaults capability and target to the tool name", async () => {
  const gate = createIntentGate({
    agent: {
      agentId: "agent_1",
      capabilities: ["email.send"],
    },
    fallbackDecision: "approved",
    policies: [],
  });

  const result = await gateToolCall(gate, {
    tool: "email.send",
    args: { to: "ops@example.com" },
  });

  assert.equal(result.intent.type, "email.send");
  assert.equal(result.intent.target, "email.send");
  assert.deepEqual(result.intent.requestedCapabilities, ["email.send"]);
  assert.equal(result.command?.target, "email.send");
});

test("gateOpenAIToolCall gates Responses API function calls", async () => {
  const gate = createIntentGate({
    agent: {
      agentId: "openai_agent",
      capabilities: ["email.send"],
    },
    policies: [
      createPolicy({
        match: (intent) => intent.type === "email.send" && intent.metadata?.args?.to === "finance@example.com",
        evaluate: () => "requires_approval",
      }),
    ],
  });

  const result = await gateOpenAIToolCall(gate, {
    id: "fc_123",
    call_id: "call_123",
    type: "function_call",
    name: "email.send",
    arguments: JSON.stringify({ to: "finance@example.com", subject: "Invoice" }),
  });

  assert.equal(result.intent.id, "call_123");
  assert.equal(result.intent.target, "openai");
  assert.deepEqual(result.intent.metadata.args, { to: "finance@example.com", subject: "Invoice" });
  assert.equal(result.intent.metadata.provider, "openai");
  assert.equal(result.intent.metadata.callId, "call_123");
  assert.equal(result.decision.outcome, "requires_approval");
});

test("gateOpenAIToolCall gates Chat Completions tool calls", async () => {
  const gate = createIntentGate({
    agent: {
      agentId: "openai_agent",
      capabilities: ["ticket.create"],
    },
    fallbackDecision: "approved",
    policies: [],
  });

  const result = await gateOpenAIToolCall(gate, {
    id: "call_456",
    type: "function",
    function: {
      name: "ticket.create",
      arguments: JSON.stringify({ title: "Refund request" }),
    },
  }, {
    target: "zendesk",
  });

  assert.equal(result.intent.id, "call_456");
  assert.equal(result.intent.target, "zendesk");
  assert.deepEqual(result.command?.payload, {
    provider: "openai",
    args: { title: "Refund request" },
  });
});

test("gateOpenAIToolCall rejects invalid JSON arguments", async () => {
  const gate = createIntentGate({
    agent: {
      agentId: "openai_agent",
      capabilities: ["ticket.create"],
    },
    policies: [],
  });

  await assert.rejects(
    () => gateOpenAIToolCall(gate, {
      type: "function_call",
      name: "ticket.create",
      arguments: "not-json",
    }),
    /valid JSON/,
  );
});

test("gateAnthropicToolUse gates Anthropic tool use blocks", async () => {
  const gate = createIntentGate({
    agent: {
      agentId: "anthropic_agent",
      capabilities: ["refund.create"],
    },
    fallbackDecision: "approved",
    policies: [],
  });

  const result = await gateAnthropicToolUse(gate, {
    id: "toolu_123",
    type: "tool_use",
    name: "refund.create",
    input: { amount: 40 },
  });

  assert.equal(result.intent.id, "toolu_123");
  assert.equal(result.intent.target, "anthropic");
  assert.deepEqual(result.command?.payload, {
    provider: "anthropic",
    args: { amount: 40 },
  });
});

test("gateMcpToolCall gates MCP tool calls", async () => {
  const gate = createIntentGate({
    agent: {
      agentId: "mcp_agent",
      capabilities: ["filesystem.write"],
    },
    policies: [
      createPolicy({
        match: (intent) => intent.type === "filesystem.write",
        evaluate: () => "requires_approval",
      }),
    ],
  });

  const result = await gateMcpToolCall(gate, {
    server: "local-dev",
    name: "filesystem.write",
    arguments: { path: "/tmp/demo.txt", content: "hello" },
  });

  assert.equal(result.intent.target, "local-dev");
  assert.equal(result.intent.metadata.provider, "mcp");
  assert.equal(result.intent.metadata.server, "local-dev");
  assert.equal(result.decision.outcome, "requires_approval");
});

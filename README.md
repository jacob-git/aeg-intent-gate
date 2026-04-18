# aeg-intent-gate

[![npm version](https://img.shields.io/npm/v/@pallattu/aeg-intent-gate.svg)](https://www.npmjs.com/package/@pallattu/aeg-intent-gate)
[![license](https://img.shields.io/npm/l/@pallattu/aeg-intent-gate.svg)](./LICENSE)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](./package.json)

Add an approval gate before AI tool calls hit your real executor.

`aeg-intent-gate` is a tiny TypeScript approval gate for AI agents, OpenAI function calls, Anthropic tool use, and MCP tools. Use it to block dangerous actions, require human approval for risky actions, emit audit-friendly lifecycle events, and only create executable commands after a decision is approved.

Live demo: [aeg-intent-gate.pages.dev](https://aeg-intent-gate.pages.dev)

Live starter app: [aeg-intent-gate-starter.pages.dev](https://aeg-intent-gate-starter.pages.dev)

![aeg-intent-gate approval flow](https://aeg-intent-gate.pages.dev/assets/approval-flow.svg)

## Install

```sh
npm install @pallattu/aeg-intent-gate
```

Try the demo without writing code:

```sh
npx @pallattu/aeg-intent-gate
```

Clone a complete starter app:

```sh
git clone https://github.com/jacob-git/aeg-intent-gate-starter.git
cd aeg-intent-gate-starter
npm install
npm start
```

Run a local approval queue in the browser:

```sh
npm run example:approval-server
```

## Quick Start: Gate An AI Tool Call

```ts
import { createIntentGate, createPolicy, gateToolCall } from "@pallattu/aeg-intent-gate";

const refundAmount = (metadata?: Record<string, unknown>) => {
  const args = metadata?.args as { amount?: number } | undefined;
  return args?.amount ?? 0;
};

const gate = createIntentGate({
  agent: {
    agentId: "support-agent",
    capabilities: ["ticket.read", "refund.create", "email.send"],
  },
  policies: [
    createPolicy({
      name: "large-refunds-need-human",
      match: (intent) => intent.type === "refund.create" && refundAmount(intent.metadata) > 100,
      evaluate: () => ({
        outcome: "requires_approval",
        reason: "Refunds above $100 require human approval.",
      }),
    }),
    createPolicy({
      name: "never-delete-users",
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

if (result.decision.outcome === "requires_approval") {
  const approved = await gate.approveIntent(result.intent, result.decision, {
    approvedBy: "human_operator",
    reason: "Customer history reviewed.",
  });

  const command = gate.toCommand(result.intent, approved);
  // Pass command to your executor.
}
```

## Copy-Paste Adapters

The fastest way to adopt the gate is to wrap the tool-call object you already receive from your model or agent runtime.

### OpenAI Responses API Function Calls

OpenAI function calls include a `name`, JSON-encoded `arguments`, and a `call_id`. Gate the call before routing it to real application code:

```ts
import { gateOpenAIToolCall } from "@pallattu/aeg-intent-gate";

const result = await gateOpenAIToolCall(gate, {
  id: "fc_123",
  call_id: "call_123",
  type: "function_call",
  name: "email.send",
  arguments: JSON.stringify({
    to: "customer@example.com",
    subject: "Refund update",
  }),
}, {
  target: "postmark",
});

if (result.command) {
  await execute(result.command);
}
```

### OpenAI Chat Completions Tool Calls

```ts
import { gateOpenAIToolCall } from "@pallattu/aeg-intent-gate";

const result = await gateOpenAIToolCall(gate, {
  id: "call_456",
  type: "function",
  function: {
    name: "ticket.create",
    arguments: JSON.stringify({ title: "Refund request" }),
  },
});
```

### Anthropic Tool Use

```ts
import { gateAnthropicToolUse } from "@pallattu/aeg-intent-gate";

const result = await gateAnthropicToolUse(gate, {
  id: "toolu_123",
  type: "tool_use",
  name: "service.restart",
  input: {
    service: "api",
    region: "us-central1",
  },
}, {
  target: "production",
});
```

### MCP Tool Calls

```ts
import { gateMcpToolCall } from "@pallattu/aeg-intent-gate";

const result = await gateMcpToolCall(gate, {
  server: "local-dev",
  name: "filesystem.write",
  arguments: {
    path: "/tmp/demo.txt",
    content: "hello",
  },
});
```

By default, unmatched actions require approval. If you want fail-open behavior for a trusted local workflow, opt in explicitly:

```ts
const gate = createIntentGate({
  agent,
  policies,
  fallbackDecision: { outcome: "approved" },
});
```

## When To Use This

Use this package when an AI agent can propose actions with side effects:

- OpenAI or Anthropic tool calls
- MCP tool execution
- shell commands
- database writes
- refunds, credits, or payments
- emails and customer messages
- deploys, restarts, or admin actions

This package is not a full policy engine, agent framework, queue, database, sandbox, identity provider, or durable audit log. It is the small runtime boundary before execution.

## Security Model

`aeg-intent-gate` protects command construction inside the process where you use it. It verifies that an executable command comes from an approved decision produced by the same gate instance for the same evaluated intent.

The gate snapshots the sanitized command payload when an intent is evaluated. If caller code later mutates intent metadata, `toCommand()` still returns the evaluated payload snapshot.

Your application is still responsible for:

- authenticating agents and human approvers
- persisting audit records and approval history
- isolating or sandboxing executors
- making side-effecting code accept only `ApprovedCommand` objects
- preventing callers from bypassing the gate and invoking executors directly

Treat this package as an in-process enforcement point, not as a complete security boundary by itself.

## Examples

Complete browser starter app:

https://github.com/jacob-git/aeg-intent-gate-starter

Live starter app:

https://aeg-intent-gate-starter.pages.dev

Live hosted demo:

https://aeg-intent-gate.pages.dev

Run the lifecycle example:

```sh
npm run example
```

Run a tool-call approval example:

```sh
npm run example:tool-call
```

Run an OpenAI-style function-call approval example:

```sh
npm run example:openai
```

Run an Anthropic-style tool-use approval example:

```sh
npm run example:anthropic
```

Run an MCP-style tool gate example:

```sh
npm run example:mcp
```

Run a local browser approval queue:

```sh
npm run example:approval-server
```

More integration notes are in [docs/INTEGRATIONS.md](./docs/INTEGRATIONS.md).
Cloudflare Pages setup notes are in [docs/CLOUDFLARE_PAGES.md](./docs/CLOUDFLARE_PAGES.md).
Framework examples are in [examples/frameworks](./examples/frameworks).

## Core Lifecycle

The runtime models an action as an intent lifecycle:

```text
proposed -> evaluated -> approved | blocked | requires_approval -> approved
```

Execution remains separate:

```text
Tool Call -> Intent -> Policy Decision -> ApprovedCommand -> Executor
```

An `Intent` describes what an agent wants to do. `proposeIntent()` assigns an id and marks it as `proposed`. `evaluateIntent()` checks agent capabilities first, then evaluates matching policies in order. `approveIntent()` converts a `requires_approval` decision into an approved decision after a human or external system approves it. `toCommand()` only creates an executable command from an approved decision produced by the same gate instance.

## API

### `gateToolCall(gate, toolCall)`

Gates a familiar tool-call shape and returns the intent, decision, and optional command.

```ts
const result = await gateToolCall(gate, {
  tool: "email.send",
  target: "postmark",
  args: {
    to: "ops@example.com",
    subject: "Deployment finished",
  },
});

if (result.command) {
  await execute(result.command);
}
```

`requestedCapabilities` defaults to `[tool]`, and `target` defaults to `tool`.

### `gateOpenAIToolCall(gate, toolCall, options?)`

Gates OpenAI Responses API function calls and Chat Completions tool calls.

```ts
const result = await gateOpenAIToolCall(gate, openAIToolCall, {
  target: "stripe",
  requestedCapabilities: ["refund.create"],
});
```

Responses API calls use `call_id` as the intent id when present. Chat Completions calls use the tool call `id`. JSON arguments must decode to an object.

### `gateAnthropicToolUse(gate, toolUse, options?)`

Gates Anthropic tool-use blocks.

```ts
const result = await gateAnthropicToolUse(gate, toolUse, {
  target: "production",
});
```

### `gateMcpToolCall(gate, toolCall, options?)`

Gates MCP-style tool calls.

```ts
const result = await gateMcpToolCall(gate, {
  server: "local-dev",
  name: "shell.exec",
  arguments: { command: "npm test" },
});
```

### `createIntentGate(config)`

Creates an intent gate.

```ts
const gate = createIntentGate({
  agent: {
    agentId: "agent_123",
    capabilities: ["logs.read"],
  },
  policies: [],
  fallbackDecision: { outcome: "requires_approval" },
  onEvent: (event) => {},
});
```

Config fields:

- `agent`: agent identity and granted capabilities.
- `policies`: ordered policy list. The first matching policy returns the decision.
- `fallbackDecision`: optional decision when no policy matches. Defaults to `requires_approval`.
- `onEvent`: optional in-memory lifecycle event listener.

### `createPolicy({ match, evaluate })`

Defines a typed policy. `match` and `evaluate` can be synchronous or asynchronous.

```ts
const policy = createPolicy({
  name: "restart-requires-approval",
  match: (intent) => intent.type === "service.restart",
  evaluate: () => ({ outcome: "requires_approval" }),
});
```

### `gate.proposeIntent(intent)`

Validates an intent, assigns an id when needed, sets status to `proposed`, and emits `IntentProposed`.

```ts
const proposed = await gate.proposeIntent({
  type: "logs.read",
  target: "api",
  requestedCapabilities: ["logs.read"],
});
```

### `gate.evaluateIntent(intent)`

Evaluates a proposed intent and returns a decision.

```ts
const decision = await gate.evaluateIntent(proposed);
```

If the agent lacks a requested capability, the decision is blocked before custom policies run. Evaluation emits `IntentEvaluated` followed by `IntentApproved`, `IntentBlocked`, or `ApprovalRequired`.

### `gate.approveIntent(intent, decision, approval)`

Approves an intent that previously returned `requires_approval`.

```ts
const approved = await gate.approveIntent(proposed, decision, {
  approvedBy: "human_1",
  reason: "Approved for the maintenance window.",
});
```

The original decision must have been produced by this gate for the same intent.

### `gate.toCommand(intent, decision)`

Creates an executable command only from an approved lifecycle decision.

```ts
if (decision.outcome === "approved") {
  const command = gate.toCommand(proposed, decision);
}
```

`toCommand()` throws if the decision is blocked, requires approval, was not produced by this gate, or does not match the evaluated intent. The command payload is sanitized JSON derived from intent metadata.

## Events

The gate emits lifecycle events through `onEvent`:

- `IntentProposed`
- `IntentEvaluated`
- `IntentApproved`
- `IntentBlocked`
- `ApprovalRequired`
- `IntentApprovalGranted`

Events include an id, timestamp, intent id, current intent status, optional decision, and metadata. Events are delivered in memory and are not persisted.

## Why This Exists

AI agents often produce structured requests that look executable. Treating those requests as commands too early makes authorization, auditability, and human approval harder to enforce.

`aeg-intent-gate` keeps proposal, policy evaluation, approval, lifecycle events, and execution handoff as separate steps. That gives applications a small guardrail layer without introducing a server, database, or framework.

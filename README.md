# aeg-intent-gate

Lightweight TypeScript policy and execution gating for AI-generated intents.

`aeg-intent-gate` provides a small runtime boundary between what an agent proposes and what your application is willing to execute. It evaluates intents against agent capabilities and custom policies, emits decision events, and only creates executable commands from approved decisions.

## Install

```sh
npm install aeg-intent-gate
```

## Quick Example

```ts
import { createIntentGate, createPolicy, type Intent } from "aeg-intent-gate";

type AppIntent = Intent<{ actor: string }>;

const gate = createIntentGate<AppIntent>({
  agent: {
    agentId: "agent_123",
    capabilities: ["logs.read"],
  },
  fallbackDecision: { outcome: "approved" },
  onEvent: (event) => {
    console.log(event.type, event.intentId, event.decision.outcome);
  },
  policies: [
    createPolicy({
      name: "block-database-drop",
      match: (intent) => intent.type === "database.drop",
      evaluate: () => ({ outcome: "blocked", reason: "Destructive database action." }),
    }),
    createPolicy({
      name: "restart-requires-approval",
      match: (intent) => intent.type === "service.restart",
      evaluate: () => ({ outcome: "requires_approval" }),
    }),
  ],
});

const intent = {
  id: "intent_456",
  type: "logs.read",
  target: "api",
  requestedCapabilities: ["logs.read"],
  metadata: { actor: "agent" },
};

const decision = await gate.evaluate(intent);

if (decision.outcome === "approved") {
  const command = gate.toCommand(intent, decision);
  // Pass command to your executor.
}
```

## Core Concept

The runtime enforces a clear boundary:

```text
Intent -> Policy Decision -> ApprovedCommand -> Executor
```

An `Intent` describes what an agent wants to do. The gate first checks whether the agent has every requested capability, then evaluates matching policies in order. Execution is separated from evaluation: callers must explicitly convert an approved decision into an `ApprovedCommand` with `toCommand()`.

`toCommand()` throws if the decision is blocked, requires approval, was not produced by this gate, or does not match the evaluated intent.

## API Usage

### `createIntentGate(config)`

Creates an intent gate.

```ts
const gate = createIntentGate({
  agent: {
    agentId: "agent_123",
    capabilities: ["logs.read"],
  },
  policies: [],
  fallbackDecision: { outcome: "approved" },
  onEvent: (event) => {},
});
```

Config fields:

- `agent`: agent identity and granted capabilities.
- `policies`: ordered policy list. The first matching policy returns the decision.
- `fallbackDecision`: optional decision when no policy matches. Defaults to approved.
- `onEvent`: optional in-memory event listener.

### `createPolicy({ match, evaluate })`

Defines a typed policy.

```ts
const policy = createPolicy({
  match: (intent) => intent.type === "service.restart",
  evaluate: () => ({ outcome: "requires_approval" }),
});
```

Policy evaluation can be synchronous or asynchronous.

### `gate.evaluate(intent)`

Evaluates an intent and returns a decision.

```ts
const decision = await gate.evaluate({
  type: "service.restart",
  target: "api",
  requestedCapabilities: ["service.restart"],
});
```

If the agent does not have a requested capability, the decision is blocked before custom policies run.

### `gate.toCommand(intent, decision)`

Creates an executable command only from an approved decision.

```ts
if (decision.outcome === "approved") {
  const command = gate.toCommand(intent, decision);
}
```

The command contains a sanitized JSON-safe payload derived from intent metadata.

## Events

When an intent is evaluated, the gate emits:

- `IntentEvaluated`
- `IntentApproved`
- `IntentBlocked`
- `ApprovalRequired`

Events include an id, timestamp, intent id, decision, and metadata. Events are delivered through the optional `onEvent` callback and are not persisted.

## Why This Exists

AI agents often produce structured requests that look executable. Treating those requests as commands too early makes authorization, auditability, and human approval harder to enforce.

`aeg-intent-gate` keeps intent, policy, and execution as separate steps. This gives applications a small governance layer for capability checks, policy decisions, event emission, and safe handoff to executors without introducing a server, database, or framework.

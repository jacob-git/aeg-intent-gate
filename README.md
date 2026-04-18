# aeg-intent-gate

Lightweight TypeScript lifecycle, policy, and execution gating for AI-generated intents.

`aeg-intent-gate` provides a small runtime boundary between what an agent proposes and what your application is willing to execute. It models intent lifecycle state, evaluates capabilities and policies, emits lifecycle events, and only creates executable commands from approved decisions.

## Install

```sh
npm install @pallattu/aeg-intent-gate
```

## Quick Example

```ts
import { createIntentGate, createPolicy, type Intent } from "@pallattu/aeg-intent-gate";

type AppIntent = Intent<{ actor: string }>;

const gate = createIntentGate<AppIntent>({
  agent: {
    agentId: "agent_123",
    capabilities: ["logs.read"],
  },
  fallbackDecision: { outcome: "approved" },
  onEvent: (event) => {
    console.log(event.type, event.status, event.intentId);
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

const proposed = await gate.proposeIntent({
  type: "logs.read",
  target: "api",
  requestedCapabilities: ["logs.read"],
  metadata: { actor: "agent" },
});

const decision = await gate.evaluateIntent(proposed);

if (decision.outcome === "approved") {
  const command = gate.toCommand(proposed, decision);
  // Pass command to your executor.
}
```

## Core Concept

The runtime models intent as a lifecycle:

```text
proposed -> evaluated -> approved | blocked | requires_approval
```

Execution remains a separate step:

```text
Intent -> Policy Decision -> ApprovedCommand -> Executor
```

An `Intent` describes what an agent wants to do. `proposeIntent()` assigns an id and marks it as `proposed`. `evaluateIntent()` checks agent capabilities first, then evaluates matching policies in order. `toCommand()` converts only an approved evaluated intent into an `ApprovedCommand`.

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
- `onEvent`: optional in-memory lifecycle event listener.

### `createPolicy({ match, evaluate })`

Defines a typed policy.

```ts
const policy = createPolicy({
  match: (intent) => intent.type === "service.restart",
  evaluate: () => ({ outcome: "requires_approval" }),
});
```

Policy evaluation can be synchronous or asynchronous.

### `gate.proposeIntent(intent)`

Validates an intent, assigns an id when needed, sets status to `proposed`, and emits an `IntentProposed` event.

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

If the agent lacks a requested capability, the decision is blocked before custom policies run. Evaluation emits `IntentEvaluated` followed by the outcome event.

### `gate.toCommand(intent, decision)`

Creates an executable command only from an approved lifecycle decision.

```ts
if (decision.outcome === "approved") {
  const command = gate.toCommand(proposed, decision);
}
```

The command contains a sanitized JSON-safe payload derived from intent metadata.

## Events

The gate emits lifecycle events through `onEvent`:

- `IntentProposed`
- `IntentEvaluated`
- `IntentApproved`
- `IntentBlocked`
- `ApprovalRequired`

Events include an id, timestamp, intent id, current intent status, optional decision, and metadata. Events are delivered in memory and are not persisted.

## Why This Exists

AI agents often produce structured requests that look executable. Treating those requests as commands too early makes authorization, auditability, and human approval harder to enforce.

`aeg-intent-gate` keeps intent proposal, policy evaluation, lifecycle events, and execution handoff as separate steps. This gives applications a small governance layer without introducing a server, database, or framework.

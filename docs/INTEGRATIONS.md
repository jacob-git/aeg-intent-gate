# Integrations

`aeg-intent-gate` is designed to sit between model-proposed tool calls and real executors.

## OpenAI

Use `gateOpenAIToolCall()` for both Responses API function calls and Chat Completions tool calls.

```ts
import { createIntentGate, createPolicy, gateOpenAIToolCall } from "@pallattu/aeg-intent-gate";

const gate = createIntentGate({
  agent: {
    agentId: "support-agent",
    capabilities: ["email.send", "refund.create"],
  },
  policies: [
    createPolicy({
      name: "outbound-email-review",
      match: (intent) => intent.type === "email.send",
      evaluate: () => ({
        outcome: "requires_approval",
        reason: "Outbound email needs human review.",
      }),
    }),
  ],
});

const result = await gateOpenAIToolCall(gate, openAIToolCall, {
  target: "postmark",
});

if (result.command) {
  await execute(result.command);
}
```

## Anthropic

Use `gateAnthropicToolUse()` for Anthropic tool-use content blocks.

```ts
import { gateAnthropicToolUse } from "@pallattu/aeg-intent-gate";

const result = await gateAnthropicToolUse(gate, toolUse, {
  target: "production",
});
```

## MCP

Use `gateMcpToolCall()` before forwarding a tool call to a local or remote MCP server.

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

For a fuller proxy skeleton, use the MCP proxy starter:

```sh
npm run example:mcp-proxy
```

Example file:

```text
examples/mcp-proxy-starter.mjs
```

It accepts JSON-RPC-style MCP requests, forwards non-tool-call requests, gates `tools/call`, blocks dangerous shell commands, queues side-effecting calls for approval, and forwards only after an `ApprovedCommand` exists. It is intentionally transport-light so you can adapt it to stdio, HTTP, or a hosted MCP gateway.

## Executor Rule

Side-effecting code should accept only `ApprovedCommand` objects. Keep raw model tool calls out of executors.

```ts
async function execute(command: ApprovedCommand) {
  switch (command.type) {
    case "email.send":
      return sendEmail(command.payload.args);
    case "refund.create":
      return createRefund(command.payload.args);
    default:
      throw new Error(`No executor for ${command.type}`);
  }
}
```

## Durable Approval Queue

The browser demo keeps pending approvals in memory. The durable queue example stores pending approvals in a JSON file, recreates the gate after a simulated restart, re-evaluates the stored tool call, and only then creates an `ApprovedCommand`.

```sh
npm run example:durable-queue
```

Example file:

```text
examples/durable-approval-queue.mjs
```

This is intentionally a small file-backed example, not a production database abstraction. In a real app, store the pending tool call, gate options, approval metadata, and resulting `ApprovedCommand` in your database or queue.

## Frameworks

The `examples/frameworks` directory includes copy-paste examples for common server and agent-runtime surfaces:

```text
examples/frameworks/hono-approval-middleware.ts
examples/frameworks/express-approval-middleware.ts
examples/frameworks/vercel-ai-sdk-tool-gate.ts
examples/frameworks/langgraph-tool-gate.ts
examples/frameworks/openai-agents-sdk-approval-gate.ts
```

The Hono and Express examples show two endpoint patterns:

- `POST /tool-calls/openai` to gate an OpenAI tool call
- `POST /approvals/:intentId` to approve a pending intent and create an executable command

The Vercel AI SDK and LangGraph-style examples show how to gate framework-native tool invocation objects before dispatching them to real tools.

The OpenAI Agents SDK example shows how to map a tool invocation shape with `toolName`, `toolCallId`, and `toolArguments` into `gateToolCall()`, return `execute`, `requires_approval`, or `blocked`, and persist pending approval state outside the SDK run.

## Deployments

Copy-paste deployment examples are in [DEPLOYMENT.md](./DEPLOYMENT.md):

```text
examples/deployments/cloudflare-pages-function.js
examples/deployments/vercel-route.ts
examples/deployments/node-server.mjs
```

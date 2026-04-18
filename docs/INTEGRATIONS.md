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

## Frameworks

The `examples/frameworks` directory includes a Hono-style approval endpoint example:

```text
examples/frameworks/hono-approval-middleware.ts
```

It shows two endpoints:

- `POST /tool-calls/openai` to gate an OpenAI tool call
- `POST /approvals/:intentId` to approve a pending intent and create an executable command

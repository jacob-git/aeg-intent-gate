import { createIntentGate, createPolicy, gateToolCall } from "../dist/index.js";

const gate = createIntentGate({
  agent: {
    agentId: "mcp_agent",
    capabilities: ["filesystem.read", "filesystem.write", "shell.exec"],
  },
  policies: [
    createPolicy({
      name: "block-dangerous-shell",
      match: (intent) => intent.type === "shell.exec"
        && /rm\s+-rf|shutdown|mkfs/.test(String(intent.metadata.args.command)),
      evaluate: () => ({
        outcome: "blocked",
        reason: "Dangerous shell command blocked.",
      }),
    }),
    createPolicy({
      name: "writes-need-review",
      match: (intent) => intent.type === "filesystem.write",
      evaluate: () => ({
        outcome: "requires_approval",
        reason: "File writes require approval.",
      }),
    }),
  ],
  fallbackDecision: {
    outcome: "requires_approval",
    reason: "Unrecognized MCP tool call.",
  },
});

async function handleMcpToolCall(toolCall) {
  const result = await gateToolCall(gate, {
    tool: toolCall.name,
    target: toolCall.server,
    args: toolCall.arguments,
  });

  if (result.command) {
    return {
      status: "execute",
      command: result.command,
    };
  }

  return {
    status: result.decision.outcome,
    reason: result.decision.reason,
    intentId: result.intent.id,
  };
}

const response = await handleMcpToolCall({
  server: "local-dev",
  name: "shell.exec",
  arguments: {
    command: "rm -rf /tmp/demo",
  },
});

console.log(JSON.stringify(response, null, 2));

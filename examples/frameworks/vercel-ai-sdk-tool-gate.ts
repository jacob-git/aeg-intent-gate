import { createIntentGate, createPolicy, gateToolCall } from "@pallattu/aeg-intent-gate";

const gate = createIntentGate({
  agent: {
    agentId: "vercel-ai-sdk-agent",
    capabilities: ["email.send", "refund.create", "ticket.create"],
  },
  policies: [
    createPolicy({
      name: "refunds-need-human",
      match: (intent) => intent.type === "refund.create",
      evaluate: () => ({
        outcome: "requires_approval",
        reason: "Refunds need human approval before execution.",
      }),
    }),
  ],
});

type VercelAiToolInvocation = {
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
};

export async function gateVercelAiToolInvocation(invocation: VercelAiToolInvocation) {
  const result = await gateToolCall(gate, {
    id: invocation.toolCallId,
    tool: invocation.toolName,
    target: invocation.toolName.split(".")[0] ?? invocation.toolName,
    args: invocation.args,
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

// In a Vercel AI SDK route, call gateVercelAiToolInvocation() before invoking
// the real tool implementation. Store requires_approval results in your queue.

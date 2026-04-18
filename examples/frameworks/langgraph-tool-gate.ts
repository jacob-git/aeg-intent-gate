import { createIntentGate, createPolicy, gateToolCall } from "@pallattu/aeg-intent-gate";

const gate = createIntentGate({
  agent: {
    agentId: "langgraph-agent",
    capabilities: ["crm.update", "email.send", "database.write"],
  },
  policies: [
    createPolicy({
      name: "writes-need-human",
      match: (intent) => intent.type.endsWith(".write") || intent.type === "crm.update",
      evaluate: () => ({
        outcome: "requires_approval",
        reason: "State-changing LangGraph tool calls require approval.",
      }),
    }),
  ],
});

type LangGraphToolCall = {
  id?: string;
  name: string;
  args: Record<string, unknown>;
};

export async function gateLangGraphToolCall(toolCall: LangGraphToolCall) {
  const result = await gateToolCall(gate, {
    id: toolCall.id,
    tool: toolCall.name,
    target: toolCall.name.split(".")[0] ?? toolCall.name,
    args: toolCall.args,
  });

  if (result.command) {
    return {
      allowed: true,
      command: result.command,
    };
  }

  return {
    allowed: false,
    intentId: result.intent.id,
    outcome: result.decision.outcome,
    reason: result.decision.reason,
  };
}

// Use gateLangGraphToolCall() in front of the node that dispatches tool calls.
// A requires_approval result should interrupt the graph and wait for review.

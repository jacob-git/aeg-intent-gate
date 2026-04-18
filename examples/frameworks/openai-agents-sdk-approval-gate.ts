import {
  createIntentGate,
  createPolicy,
  type ApprovalContext,
  type ApprovedCommand,
  type Decision,
  type Intent,
  type ManagedIntent,
  gateToolCall,
} from "@pallattu/aeg-intent-gate";

type OpenAIAgentsSdkToolInvocation = {
  toolName: string;
  toolCallId?: string;
  toolArguments: Record<string, unknown>;
};

type AgentsSdkGateResult =
  | {
      action: "execute";
      command: ApprovedCommand;
    }
  | {
      action: "requires_approval" | "blocked";
      intentId: string;
      decision: Decision;
    };

type PendingAgentsSdkApproval = {
  invocation: OpenAIAgentsSdkToolInvocation;
  intent: ManagedIntent<Intent>;
  decision: Decision;
};

export class InMemoryAgentsSdkApprovalStore {
  #records = new Map<string, PendingAgentsSdkApproval>();

  save(record: PendingAgentsSdkApproval) {
    this.#records.set(record.intent.id, record);
  }

  get(intentId: string) {
    return this.#records.get(intentId);
  }

  delete(intentId: string) {
    this.#records.delete(intentId);
  }
}

export function createAgentsSdkApprovalGate() {
  return createIntentGate({
    agent: {
      agentId: "openai-agents-sdk-agent",
      capabilities: ["email.send", "refund.create", "ticket.create"],
    },
    policies: [
      createPolicy({
        name: "block-large-refunds",
        match: (intent) => intent.type === "refund.create"
          && Number(intent.metadata.args.amount ?? 0) > 500,
        evaluate: () => ({
          outcome: "blocked",
          reason: "Refunds over 500 must use the billing admin workflow.",
        }),
      }),
      createPolicy({
        name: "review-side-effects",
        match: (intent) => ["email.send", "refund.create"].includes(intent.type),
        evaluate: () => ({
          outcome: "requires_approval",
          reason: "Side-effecting agent tools require human approval.",
        }),
      }),
    ],
    fallbackDecision: {
      outcome: "requires_approval",
      reason: "Unknown agent tool requires review.",
    },
  });
}

export async function gateOpenAIAgentsSdkToolInvocation(
  gate: ReturnType<typeof createAgentsSdkApprovalGate>,
  invocation: OpenAIAgentsSdkToolInvocation,
): Promise<{ routed: AgentsSdkGateResult; pending?: PendingAgentsSdkApproval }> {
  const result = await gateToolCall(gate, {
    id: invocation.toolCallId,
    tool: invocation.toolName,
    target: "openai-agents-sdk",
    args: invocation.toolArguments,
  });

  if (result.command) {
    return {
      routed: {
        action: "execute",
        command: result.command,
      },
    };
  }

  const routed = {
    action: result.decision.outcome,
    intentId: result.intent.id,
    decision: result.decision,
  } as AgentsSdkGateResult;

  return {
    routed,
    pending: result.decision.outcome === "requires_approval"
      ? {
          invocation,
          intent: result.intent,
          decision: result.decision,
        }
      : undefined,
  };
}

export async function routeOpenAIAgentsSdkToolInvocation(
  store: InMemoryAgentsSdkApprovalStore,
  invocation: OpenAIAgentsSdkToolInvocation,
): Promise<AgentsSdkGateResult> {
  const gate = createAgentsSdkApprovalGate();
  const result = await gateOpenAIAgentsSdkToolInvocation(gate, invocation);
  if (result.pending) store.save(result.pending);
  return result.routed;
}

export async function approveOpenAIAgentsSdkToolInvocation(
  store: InMemoryAgentsSdkApprovalStore,
  intentId: string,
  approval: ApprovalContext,
): Promise<ApprovedCommand> {
  const record = store.get(intentId);
  if (!record) throw new Error(`Unknown pending OpenAI Agents SDK intent: ${intentId}`);

  const gate = createAgentsSdkApprovalGate();
  const replayed = await gateOpenAIAgentsSdkToolInvocation(gate, record.invocation);

  if (!replayed.pending) {
    throw new Error("Stored OpenAI Agents SDK invocation no longer requires approval.");
  }
  if (replayed.pending.intent.id !== record.intent.id) {
    throw new Error("Stored OpenAI Agents SDK invocation produced a different intent id.");
  }

  const approved = await gate.approveIntent(replayed.pending.intent, replayed.pending.decision, approval);
  const command = gate.toCommand(replayed.pending.intent, approved);
  store.delete(intentId);
  return command;
}

/*
OpenAI Agents SDK wiring sketch:

import { tool } from "@openai/agents";
import { z } from "zod";

const approvals = new InMemoryAgentsSdkApprovalStore();

export const sendEmailTool = tool({
  name: "email.send",
  description: "Send an email.",
  parameters: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
  }),
  needsApproval: async (_context, args) => {
    const result = await routeOpenAIAgentsSdkToolInvocation(approvals, {
      toolName: "email.send",
      toolCallId: crypto.randomUUID(),
      toolArguments: args,
    });
    return result.action === "requires_approval";
  },
  execute: async (args) => {
    // Execute only after your app has converted the pending intent into an ApprovedCommand.
    // Store that command in your database and make the real executor accept only ApprovedCommand.
    return `email approved for ${args.to}`;
  },
});
*/

import type { ApprovedCommand, Decision, Intent, IntentGate, ManagedIntent } from "./types.js";

export type ToolCall<Args extends Record<string, unknown> = Record<string, unknown>> = {
  id?: string;
  tool: string;
  target?: string;
  args?: Args;
  requestedCapabilities?: string[];
  metadata?: Record<string, unknown>;
};

export type ToolCallGateResult<TIntent extends Intent = Intent> = {
  intent: ManagedIntent<TIntent>;
  decision: Decision;
  command?: ApprovedCommand;
};

export async function gateToolCall<Args extends Record<string, unknown> = Record<string, unknown>>(
  gate: IntentGate<Intent>,
  toolCall: ToolCall<Args>,
): Promise<ToolCallGateResult> {
  validateToolCall(toolCall);
  const intent = await gate.proposeIntent({
    id: toolCall.id,
    type: toolCall.tool,
    target: toolCall.target ?? toolCall.tool,
    requestedCapabilities: toolCall.requestedCapabilities ?? [toolCall.tool],
    metadata: {
      ...(toolCall.metadata ?? {}),
      args: toolCall.args ?? {},
    },
  });
  const decision = await gate.evaluateIntent(intent);
  return {
    intent,
    decision,
    command: decision.outcome === "approved" ? gate.toCommand(intent, decision) : undefined,
  };
}

function validateToolCall(toolCall: ToolCall): void {
  if (!isRecord(toolCall)) throw new TypeError("Tool call must be an object.");
  if (toolCall.id !== undefined && !isNonEmptyString(toolCall.id)) throw new TypeError("ToolCall.id must be a non-empty string when provided.");
  if (!isNonEmptyString(toolCall.tool)) throw new TypeError("ToolCall.tool must be a non-empty string.");
  if (toolCall.target !== undefined && !isNonEmptyString(toolCall.target)) throw new TypeError("ToolCall.target must be a non-empty string when provided.");
  if (toolCall.args !== undefined && !isRecord(toolCall.args)) throw new TypeError("ToolCall.args must be an object when provided.");
  if (toolCall.metadata !== undefined && !isRecord(toolCall.metadata)) throw new TypeError("ToolCall.metadata must be an object when provided.");
  if (toolCall.requestedCapabilities !== undefined && !isStringArray(toolCall.requestedCapabilities)) {
    throw new TypeError("ToolCall.requestedCapabilities must be an array of non-empty strings when provided.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

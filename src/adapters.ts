import { gateToolCall, type ToolCallGateResult } from "./tool-call.js";
import type { Intent, IntentGate } from "./types.js";

export type AdapterGateOptions = {
  target?: string;
  requestedCapabilities?: string[];
  metadata?: Record<string, unknown>;
};

export type OpenAIResponsesFunctionCall = {
  id?: string;
  call_id?: string;
  type?: "function_call";
  name: string;
  arguments?: string;
};

export type OpenAIChatToolCall = {
  id?: string;
  type?: "function";
  function: {
    name: string;
    arguments?: string;
  };
};

export type AnthropicToolUse = {
  id?: string;
  type?: "tool_use";
  name: string;
  input?: Record<string, unknown>;
};

export type McpToolCall = {
  id?: string;
  server?: string;
  name: string;
  arguments?: Record<string, unknown>;
};

export async function gateOpenAIToolCall(
  gate: IntentGate<Intent>,
  toolCall: OpenAIResponsesFunctionCall | OpenAIChatToolCall,
  options: AdapterGateOptions = {},
): Promise<ToolCallGateResult> {
  const normalized = normalizeOpenAIToolCall(toolCall);
  return gateToolCall(gate, {
    id: normalized.id,
    tool: normalized.name,
    target: options.target ?? "openai",
    requestedCapabilities: options.requestedCapabilities,
    args: parseJsonObject(normalized.arguments, "OpenAI tool call arguments"),
    metadata: {
      provider: "openai",
      ...(normalized.callId ? { callId: normalized.callId } : {}),
      ...(options.metadata ?? {}),
    },
  });
}

export async function gateAnthropicToolUse(
  gate: IntentGate<Intent>,
  toolUse: AnthropicToolUse,
  options: AdapterGateOptions = {},
): Promise<ToolCallGateResult> {
  validateToolName(toolUse, "Anthropic tool use");
  return gateToolCall(gate, {
    id: toolUse.id,
    tool: toolUse.name,
    target: options.target ?? "anthropic",
    requestedCapabilities: options.requestedCapabilities,
    args: toolUse.input ?? {},
    metadata: {
      provider: "anthropic",
      ...(options.metadata ?? {}),
    },
  });
}

export async function gateMcpToolCall(
  gate: IntentGate<Intent>,
  toolCall: McpToolCall,
  options: AdapterGateOptions = {},
): Promise<ToolCallGateResult> {
  validateToolName(toolCall, "MCP tool call");
  return gateToolCall(gate, {
    id: toolCall.id,
    tool: toolCall.name,
    target: options.target ?? toolCall.server ?? "mcp",
    requestedCapabilities: options.requestedCapabilities,
    args: toolCall.arguments ?? {},
    metadata: {
      provider: "mcp",
      ...(toolCall.server ? { server: toolCall.server } : {}),
      ...(options.metadata ?? {}),
    },
  });
}

function normalizeOpenAIToolCall(toolCall: OpenAIResponsesFunctionCall | OpenAIChatToolCall): {
  id?: string;
  callId?: string;
  name: string;
  arguments?: string;
} {
  if (!isRecord(toolCall)) throw new TypeError("OpenAI tool call must be an object.");
  if ("function" in toolCall) {
    if (!isRecord(toolCall.function)) throw new TypeError("OpenAI chat tool call function must be an object.");
    validateToolName(toolCall.function, "OpenAI chat tool call function");
    return {
      id: optionalString(toolCall.id, "OpenAI chat tool call id"),
      name: toolCall.function.name,
      arguments: optionalString(toolCall.function.arguments, "OpenAI chat tool call arguments"),
    };
  }

  validateToolName(toolCall, "OpenAI Responses function call");
  return {
    id: optionalString(toolCall.call_id ?? toolCall.id, "OpenAI Responses function call id"),
    callId: optionalString(toolCall.call_id, "OpenAI Responses function call call_id"),
    name: toolCall.name,
    arguments: optionalString(toolCall.arguments, "OpenAI Responses function call arguments"),
  };
}

function parseJsonObject(value: string | undefined, label: string): Record<string, unknown> {
  if (value === undefined || value.length === 0) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new TypeError(`${label} must be valid JSON.`);
  }
  if (!isRecord(parsed)) throw new TypeError(`${label} must decode to an object.`);
  return parsed;
}

function validateToolName(value: unknown, label: string): asserts value is { name: string } {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object.`);
  if (!isNonEmptyString(value.name)) throw new TypeError(`${label} name must be a non-empty string.`);
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (!isNonEmptyString(value)) throw new TypeError(`${label} must be a non-empty string when provided.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

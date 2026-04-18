import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../examples/frameworks/openai-agents-sdk-approval-gate.ts", import.meta.url), "utf8");

test("OpenAI Agents SDK example exposes approval routing helpers", () => {
  assert.match(source, /gateOpenAIAgentsSdkToolInvocation/);
  assert.match(source, /routeOpenAIAgentsSdkToolInvocation/);
  assert.match(source, /approveOpenAIAgentsSdkToolInvocation/);
  assert.match(source, /needsApproval/);
});

test("OpenAI Agents SDK example maps invocation shape into gateToolCall", () => {
  assert.match(source, /toolName: string/);
  assert.match(source, /toolCallId\?: string/);
  assert.match(source, /toolArguments: Record<string, unknown>/);
  assert.match(source, /gateToolCall\(gate/);
  assert.match(source, /tool: invocation\.toolName/);
  assert.match(source, /args: invocation\.toolArguments/);
});

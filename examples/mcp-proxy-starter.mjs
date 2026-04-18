import { fileURLToPath } from "node:url";
import { createIntentGate, createPolicy, gateMcpToolCall } from "../dist/index.js";

export class InMemoryMcpApprovalStore {
  #records = new Map();

  listPending() {
    return [...this.#records.values()].filter((record) => record.status === "pending");
  }

  get(intentId) {
    return this.#records.get(intentId);
  }

  savePending(record) {
    const stored = {
      ...record,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.#records.set(record.intent.id, stored);
    return stored;
  }

  markApproved(intentId, approval, command, upstreamResponse) {
    const record = this.#records.get(intentId);
    if (!record) throw new Error(`Unknown pending MCP intent: ${intentId}`);
    const stored = {
      ...record,
      status: "approved",
      approval: {
        ...approval,
        approvedAt: new Date().toISOString(),
      },
      command,
      upstreamResponse,
    };
    this.#records.set(intentId, stored);
    return stored;
  }
}

export function createDefaultMcpGate() {
  return createIntentGate({
    agent: {
      agentId: "mcp_proxy_agent",
      capabilities: ["filesystem.read", "filesystem.write", "shell.exec", "ticket.create"],
    },
    policies: [
      createPolicy({
        name: "block-dangerous-shell",
        match: (intent) => intent.type === "shell.exec"
          && /(?:^|\s)(rm\s+-rf|shutdown|mkfs)(?:\s|$)/.test(String(intent.metadata.args.command)),
        evaluate: () => ({
          outcome: "blocked",
          reason: "Dangerous shell command blocked before the MCP server saw it.",
        }),
      }),
      createPolicy({
        name: "review-side-effects",
        match: (intent) => ["filesystem.write", "shell.exec", "ticket.create"].includes(intent.type),
        evaluate: () => ({
          outcome: "requires_approval",
          reason: "Side-effecting MCP tool calls require human approval.",
        }),
      }),
      createPolicy({
        name: "allow-readonly",
        match: (intent) => intent.type === "filesystem.read",
        evaluate: () => ({
          outcome: "approved",
          reason: "Read-only MCP tool call approved.",
        }),
      }),
    ],
  });
}

export function createDemoMcpServer() {
  return async function forwardToDemoMcpServer(request, command) {
    if (request.method === "tools/list") {
      return jsonRpcResult(request.id, {
        tools: [
          { name: "filesystem.read", description: "Read a file." },
          { name: "filesystem.write", description: "Write a file." },
          { name: "shell.exec", description: "Run a shell command." },
          { name: "ticket.create", description: "Create a support ticket." },
        ],
      });
    }

    if (request.method === "tools/call") {
      return jsonRpcResult(request.id, {
        content: [
          {
            type: "text",
            text: `Forwarded approved ${command.type} to the upstream MCP server.`,
          },
        ],
      });
    }

    return jsonRpcResult(request.id, { ok: true });
  };
}

export function createMcpProxyStarter({
  gate = createDefaultMcpGate(),
  store = new InMemoryMcpApprovalStore(),
  forwardRequest = createDemoMcpServer(),
} = {}) {
  return {
    store,
    async handleJsonRpc(request) {
      validateJsonRpcRequest(request);

      if (request.method !== "tools/call") {
        return forwardRequest(request);
      }

      const toolCall = toMcpToolCall(request);
      const result = await gateMcpToolCall(gate, toolCall);

      if (result.command) {
        return forwardRequest(request, result.command);
      }

      if (result.decision.outcome === "blocked") {
        return jsonRpcError(request.id, -32001, result.decision.reason ?? "MCP tool call blocked.", {
          intentId: result.intent.id,
          decision: result.decision,
        });
      }

      store.savePending({
        request,
        toolCall,
        intent: result.intent,
        decision: result.decision,
      });

      return jsonRpcResult(request.id, {
        status: "requires_approval",
        intentId: result.intent.id,
        reason: result.decision.reason,
      });
    },
    async approve(intentId, approval) {
      const record = store.get(intentId);
      if (!record) throw new Error(`Unknown pending MCP intent: ${intentId}`);
      if (record.status !== "pending") throw new Error(`Cannot approve ${record.status} MCP intent.`);

      const approved = await gate.approveIntent(record.intent, record.decision, approval);
      const command = gate.toCommand(record.intent, approved);
      const upstreamResponse = await forwardRequest(record.request, command);
      store.markApproved(intentId, approval, command, upstreamResponse);
      return {
        command,
        upstreamResponse,
      };
    },
  };
}

export async function runMcpProxyStarterDemo() {
  const proxy = createMcpProxyStarter();

  const listTools = await proxy.handleJsonRpc({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  });

  const readResult = await proxy.handleJsonRpc({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "filesystem.read",
      arguments: { path: "/tmp/demo.txt" },
    },
  });

  const writeReview = await proxy.handleJsonRpc({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "filesystem.write",
      arguments: { path: "/tmp/demo.txt", content: "hello" },
    },
  });

  const approvedWrite = await proxy.approve(writeReview.result.intentId, {
    approvedBy: "human_operator",
    reason: "Reviewed write path and content.",
  });

  const blockedShell = await proxy.handleJsonRpc({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "shell.exec",
      arguments: { command: "rm -rf /tmp/demo" },
    },
  });

  return {
    listTools,
    readResult,
    writeReview,
    approvedWrite,
    blockedShell,
    pending: proxy.store.listPending(),
  };
}

function toMcpToolCall(request) {
  const params = request.params;
  if (!isRecord(params)) throw new TypeError("MCP tools/call params must be an object.");
  if (!isNonEmptyString(params.name)) throw new TypeError("MCP tools/call params.name must be a non-empty string.");
  if (params.arguments !== undefined && !isRecord(params.arguments)) {
    throw new TypeError("MCP tools/call params.arguments must be an object when provided.");
  }

  return {
    id: request.id === undefined ? undefined : `mcp_${String(request.id)}`,
    server: isNonEmptyString(params.server) ? params.server : "upstream-mcp",
    name: params.name,
    arguments: params.arguments ?? {},
  };
}

function validateJsonRpcRequest(request) {
  if (!isRecord(request)) throw new TypeError("JSON-RPC request must be an object.");
  if (request.jsonrpc !== "2.0") throw new TypeError("JSON-RPC request must use jsonrpc: \"2.0\".");
  if (!isNonEmptyString(request.method)) throw new TypeError("JSON-RPC request method must be a non-empty string.");
}

function jsonRpcResult(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function jsonRpcError(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runMcpProxyStarterDemo();
  console.log(JSON.stringify(result, null, 2));
}

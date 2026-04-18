import assert from "node:assert/strict";
import test from "node:test";
import { createMcpProxyStarter, runMcpProxyStarterDemo } from "../examples/mcp-proxy-starter.mjs";

test("MCP proxy forwards read-only tool calls", async () => {
  const forwarded = [];
  const proxy = createMcpProxyStarter({
    forwardRequest: async (request, command) => {
      forwarded.push({ request, command });
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: { ok: true, type: command?.type },
      };
    },
  });

  const response = await proxy.handleJsonRpc({
    jsonrpc: "2.0",
    id: "read-1",
    method: "tools/call",
    params: {
      name: "filesystem.read",
      arguments: { path: "/tmp/demo.txt" },
    },
  });

  assert.equal(response.result.ok, true);
  assert.equal(response.result.type, "filesystem.read");
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].command.type, "filesystem.read");
  assert.equal(forwarded[0].command.target, "upstream-mcp");
});

test("MCP proxy queues side effects until approval", async () => {
  const forwarded = [];
  const proxy = createMcpProxyStarter({
    forwardRequest: async (request, command) => {
      forwarded.push({ request, command });
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: { ok: true, approvedType: command.type },
      };
    },
  });

  const pending = await proxy.handleJsonRpc({
    jsonrpc: "2.0",
    id: "write-1",
    method: "tools/call",
    params: {
      name: "filesystem.write",
      arguments: { path: "/tmp/demo.txt", content: "hello" },
    },
  });

  assert.equal(pending.result.status, "requires_approval");
  assert.equal(proxy.store.listPending().length, 1);
  assert.equal(forwarded.length, 0);

  const approved = await proxy.approve(pending.result.intentId, {
    approvedBy: "human_operator",
    reason: "Reviewed write.",
  });

  assert.equal(approved.command.type, "filesystem.write");
  assert.deepEqual(approved.command.payload.args, {
    path: "/tmp/demo.txt",
    content: "hello",
  });
  assert.equal(approved.upstreamResponse.result.approvedType, "filesystem.write");
  assert.equal(forwarded.length, 1);
});

test("MCP proxy blocks dangerous tool calls before forwarding", async () => {
  const forwarded = [];
  const proxy = createMcpProxyStarter({
    forwardRequest: async (request, command) => {
      forwarded.push({ request, command });
      return { jsonrpc: "2.0", id: request.id, result: { ok: true } };
    },
  });

  const response = await proxy.handleJsonRpc({
    jsonrpc: "2.0",
    id: "shell-1",
    method: "tools/call",
    params: {
      name: "shell.exec",
      arguments: { command: "rm -rf /tmp/demo" },
    },
  });

  assert.equal(response.error.code, -32001);
  assert.equal(response.error.data.decision.outcome, "blocked");
  assert.equal(forwarded.length, 0);
});

test("MCP proxy starter demo covers list, approve, and block paths", async () => {
  const result = await runMcpProxyStarterDemo();

  assert.equal(result.listTools.result.tools.length, 4);
  assert.equal(result.readResult.result.content[0].text.includes("filesystem.read"), true);
  assert.equal(result.writeReview.result.status, "requires_approval");
  assert.equal(result.approvedWrite.command.type, "filesystem.write");
  assert.equal(result.blockedShell.error.code, -32001);
});

import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  approvePersistedOpenAIToolCall,
  gateAndPersistOpenAIToolCall,
  JsonFileApprovalQueue,
  runDurableQueueDemo,
} from "../examples/durable-approval-queue.mjs";

test("durable approval queue survives restart and creates an approved command", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aeg-queue-"));
  const file = join(dir, "queue.json");
  const queue = new JsonFileApprovalQueue(file);

  const result = await gateAndPersistOpenAIToolCall(queue, {
    id: "fc_refund",
    call_id: "call_refund",
    type: "function_call",
    name: "refund.create",
    arguments: JSON.stringify({
      customerId: "cus_123",
      amount: 250,
    }),
  }, {
    target: "stripe",
  });

  assert.equal(result.decision.outcome, "requires_approval");

  const restartedQueue = new JsonFileApprovalQueue(file);
  assert.equal((await restartedQueue.listPending()).length, 1);

  const command = await approvePersistedOpenAIToolCall(restartedQueue, "call_refund", {
    approvedBy: "human_operator",
    reason: "Approved after restart.",
  });

  assert.equal(command.intentId, "call_refund");
  assert.equal(command.type, "refund.create");
  assert.equal(command.target, "stripe");
  assert.deepEqual(command.payload.args, {
    customerId: "cus_123",
    amount: 250,
  });

  const stored = JSON.parse(await readFile(file, "utf8"));
  assert.equal(stored.records.call_refund.status, "approved");
  assert.equal(stored.records.call_refund.approval.approvedBy, "human_operator");
  assert.equal(stored.records.call_refund.command.intentId, "call_refund");
});

test("durable approval queue demo returns pending count and command", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aeg-queue-demo-"));
  const file = join(dir, "queue.json");
  const result = await runDurableQueueDemo(file);

  assert.equal(result.pendingBeforeApproval, 1);
  assert.equal(result.decision.outcome, "requires_approval");
  assert.equal(result.command.type, "refund.create");
  assert.equal(result.records[0].status, "approved");
});

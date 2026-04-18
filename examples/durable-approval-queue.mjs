import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createIntentGate, createPolicy, gateOpenAIToolCall } from "../dist/index.js";

const defaultQueueFile = resolve(dirname(fileURLToPath(import.meta.url)), ".durable-approval-queue.json");

export class JsonFileApprovalQueue {
  constructor(filePath = defaultQueueFile) {
    this.filePath = filePath;
  }

  async list() {
    const store = await this.#read();
    return Object.values(store.records);
  }

  async listPending() {
    return (await this.list()).filter((record) => record.status === "pending");
  }

  async get(intentId) {
    const store = await this.#read();
    return store.records[intentId];
  }

  async enqueue(record) {
    const store = await this.#read();
    store.records[record.intent.id] = {
      ...record,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    await this.#write(store);
    return store.records[record.intent.id];
  }

  async markApproved(intentId, approval, command) {
    const store = await this.#read();
    const record = store.records[intentId];
    if (!record) throw new Error(`Unknown pending intent: ${intentId}`);
    store.records[intentId] = {
      ...record,
      status: "approved",
      approval: {
        ...approval,
        approvedAt: new Date().toISOString(),
      },
      command,
    };
    await this.#write(store);
    return store.records[intentId];
  }

  async #read() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.records) {
        throw new Error("Approval queue file is not a valid queue.");
      }
      return parsed;
    } catch (error) {
      if (error.code === "ENOENT") return { records: {} };
      throw error;
    }
  }

  async #write(store) {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(store, null, 2)}\n`);
  }
}

export function createSupportGate() {
  return createIntentGate({
    agent: {
      agentId: "durable_support_agent",
      capabilities: ["email.send", "refund.create", "user.delete"],
    },
    policies: [
      createPolicy({
        name: "block-user-delete",
        match: (intent) => intent.type === "user.delete",
        evaluate: () => ({
          outcome: "blocked",
          reason: "User deletion is not allowed from this agent.",
        }),
      }),
      createPolicy({
        name: "review-side-effects",
        match: (intent) => ["email.send", "refund.create"].includes(intent.type),
        evaluate: () => ({
          outcome: "requires_approval",
          reason: "Side-effecting tool calls require human review.",
        }),
      }),
    ],
  });
}

export async function gateAndPersistOpenAIToolCall(queue, toolCall, options = {}) {
  const gate = createSupportGate();
  const result = await gateOpenAIToolCall(gate, toolCall, options);

  if (result.decision.outcome === "requires_approval") {
    await queue.enqueue({
      provider: "openai",
      toolCall,
      options,
      intent: result.intent,
      decision: result.decision,
    });
  }

  return result;
}

export async function approvePersistedOpenAIToolCall(queue, intentId, approval) {
  const record = await queue.get(intentId);
  if (!record) throw new Error(`Unknown pending intent: ${intentId}`);
  if (record.status !== "pending") throw new Error(`Cannot approve ${record.status} intent.`);

  // Recreate the gate after restart, then re-evaluate the stored model tool call.
  // This rebuilds the gate's internal decision proof before approving.
  const gate = createSupportGate();
  const result = await gateOpenAIToolCall(gate, record.toolCall, record.options);

  if (result.intent.id !== record.intent.id) {
    throw new Error("Stored tool call produced a different intent id.");
  }
  if (result.decision.outcome !== "requires_approval") {
    throw new Error(`Stored tool call re-evaluated to ${result.decision.outcome}.`);
  }

  const approved = await gate.approveIntent(result.intent, result.decision, approval);
  const command = gate.toCommand(result.intent, approved);
  await queue.markApproved(intentId, approval, command);
  return command;
}

export async function runDurableQueueDemo(filePath = defaultQueueFile) {
  const queue = new JsonFileApprovalQueue(filePath);
  const toolCall = {
    id: "fc_refund",
    call_id: "call_refund",
    type: "function_call",
    name: "refund.create",
    arguments: JSON.stringify({
      customerId: "cus_123",
      amount: 250,
      reason: "Duplicate charge.",
    }),
  };

  const initial = await gateAndPersistOpenAIToolCall(queue, toolCall, {
    target: "stripe",
  });
  const afterRestart = new JsonFileApprovalQueue(filePath);
  const pending = await afterRestart.listPending();
  const command = await approvePersistedOpenAIToolCall(afterRestart, initial.intent.id, {
    approvedBy: "human_operator",
    reason: "Customer history reviewed after restart.",
    metadata: { ticket: "SUP-431" },
  });

  return {
    queueFile: filePath,
    pendingBeforeApproval: pending.length,
    decision: initial.decision,
    command,
    records: await afterRestart.list(),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runDurableQueueDemo(process.env.QUEUE_FILE ?? defaultQueueFile);
  console.log(JSON.stringify(result, null, 2));
}

import type { AgentContext, ApprovalContext, ApprovedCommand, Decision, DecisionInput, Event, EventListener, EventType, Intent, IntentGate, IntentGateConfig, IntentStatus, JsonValue, ManagedIntent, Policy } from "./types.js";

const defaultFallbackDecision: Decision = { outcome: "approved" };
type EvaluatedIntent = {
  intentId: string;
  type: string;
  target: string;
  requestedCapabilities: string[];
  status: IntentStatus;
};

export function createPolicy<TIntent extends Intent = Intent>(
  policy: Policy<TIntent>,
): Policy<TIntent> {
  return policy;
}

export function createIntentGate<TIntent extends Intent = Intent>(
  config: IntentGateConfig<TIntent>,
): IntentGate<TIntent> {
  validateAgent(config.agent);
  const agent = { agentId: config.agent.agentId, capabilities: [...config.agent.capabilities] };
  const policies = [...config.policies];
  const fallbackDecision = normalizeDecision(config.fallbackDecision ?? defaultFallbackDecision);
  const onEvent = config.onEvent;
  const evaluatedDecisions = new WeakMap<Decision, EvaluatedIntent>();
  return {
    async proposeIntent(intent: TIntent): Promise<ManagedIntent<TIntent>> {
      validateIntent(intent);
      const proposed = { ...intent, id: intent.id ?? createId("intent"), status: "proposed" as const };
      await emitEvent(onEvent, "IntentProposed", proposed.id, "proposed", { agentId: agent.agentId });
      return proposed;
    },
    async evaluateIntent(intent: ManagedIntent<TIntent>): Promise<Decision> {
      validateIntent(intent);
      if (intent.status !== "proposed") {
        throw new Error(`Cannot evaluate intent with ${intent.status} status.`);
      }
      const intentId = intent.id;
      let decision = normalizeDecision(fallbackDecision);
      let metadata: Record<string, unknown> = { fallback: true };
      const missingCapabilities = findMissingCapabilities(intent, agent);

      if (missingCapabilities.length > 0) {
        decision = {
          outcome: "blocked",
          reason: "Agent lacks required capabilities.",
          metadata: { agentId: agent.agentId, missingCapabilities },
        };
        metadata = { agentId: agent.agentId, missingCapabilities };
      } else {
        for (const policy of policies) {
          if (await policy.match(intent)) {
            decision = normalizeDecision(await policy.evaluate(intent));
            metadata = policy.name ? { agentId: agent.agentId, policy: policy.name } : { agentId: agent.agentId };
            break;
          }
        }

        if (metadata.fallback) metadata = { ...metadata, agentId: agent.agentId };
      }

      intent.status = "evaluated";
      await emitEvent(onEvent, "IntentEvaluated", intentId, "evaluated", metadata, decision);
      intent.status = toIntentStatus(decision);
      await emitEvent(onEvent, toDecisionEventType(decision), intentId, intent.status, metadata, decision);
      evaluatedDecisions.set(decision, {
        intentId,
        type: intent.type,
        target: intent.target,
        requestedCapabilities: [...intent.requestedCapabilities],
        status: intent.status,
      });
      return decision;
    },
    async approveIntent(
      intent: ManagedIntent<TIntent>,
      decision: Decision,
      approval: ApprovalContext,
    ): Promise<Decision> {
      validateIntent(intent);
      validateApproval(approval);
      const evaluated = evaluatedDecisions.get(decision);
      if (!evaluated) {
        throw new Error("Cannot approve intent from an unevaluated decision.");
      }
      if (!isSameIntent(intent, evaluated)) {
        throw new Error("Cannot approve a decision for a different intent.");
      }
      if (decision.outcome !== "requires_approval") {
        throw new Error(`Cannot approve intent with ${decision.outcome} decision.`);
      }
      if (intent.status !== "requires_approval") {
        throw new Error(`Cannot approve intent with ${intent.status} status.`);
      }

      const approved = normalizeDecision({
        outcome: "approved",
        reason: approval.reason,
        metadata: {
          ...(approval.metadata ?? {}),
          approvedBy: approval.approvedBy,
        },
      });
      const metadata = {
        agentId: agent.agentId,
        approvedBy: approval.approvedBy,
        ...(approval.reason ? { reason: approval.reason } : {}),
      };
      intent.status = "approved";
      await emitEvent(onEvent, "IntentApprovalGranted", intent.id, "approved", metadata, approved);
      evaluatedDecisions.set(approved, { ...evaluated, status: "approved" });
      return approved;
    },
    toCommand(intent: ManagedIntent<TIntent>, decision: Decision): ApprovedCommand {
      validateIntent(intent);
      const evaluated = evaluatedDecisions.get(decision);
      if (!evaluated) {
        throw new Error("Cannot create command from an unevaluated decision.");
      }
      if (!isSameIntent(intent, evaluated)) {
        throw new Error("Cannot create command from a decision for a different intent.");
      }
      if (decision.outcome !== "approved") {
        throw new Error(`Cannot create command for ${decision.outcome} intent.`);
      }
      if (intent.status !== "approved") {
        throw new Error(`Cannot create command for intent with ${intent.status} status.`);
      }

      return {
        id: createId("command"),
        intentId: evaluated.intentId,
        agentId: agent.agentId,
        type: intent.type,
        target: intent.target,
        payload: sanitizePayload(intent.metadata),
      };
    },
  };
}

function normalizeDecision(decision: DecisionInput): Decision {
  return typeof decision === "string" ? { outcome: decision } : { ...decision };
}

function validateIntent(intent: Intent): void {
  if (!isRecord(intent)) throw new TypeError("Intent must be an object.");
  if (intent.id !== undefined && !isNonEmptyString(intent.id)) throw new TypeError("Intent.id must be a non-empty string when provided.");
  if (!isNonEmptyString(intent.type)) throw new TypeError("Intent.type must be a non-empty string.");
  if (!isNonEmptyString(intent.target)) throw new TypeError("Intent.target must be a non-empty string.");
  if (!isStringArray(intent.requestedCapabilities)) throw new TypeError("Intent.requestedCapabilities must be an array of non-empty strings.");
  if (intent.metadata !== undefined && !isRecord(intent.metadata)) throw new TypeError("Intent.metadata must be an object when provided.");
}

function validateAgent(agent: AgentContext): void {
  if (!isRecord(agent)) throw new TypeError("Agent context must be an object.");
  if (!isNonEmptyString(agent.agentId)) throw new TypeError("Agent.agentId must be a non-empty string.");
  if (!isStringArray(agent.capabilities)) throw new TypeError("Agent.capabilities must be an array of non-empty strings.");
}

function validateApproval(approval: ApprovalContext): void {
  if (!isRecord(approval)) throw new TypeError("Approval context must be an object.");
  if (!isNonEmptyString(approval.approvedBy)) throw new TypeError("Approval.approvedBy must be a non-empty string.");
  if (approval.reason !== undefined && !isNonEmptyString(approval.reason)) throw new TypeError("Approval.reason must be a non-empty string when provided.");
  if (approval.metadata !== undefined && !isRecord(approval.metadata)) throw new TypeError("Approval.metadata must be an object when provided.");
}

function findMissingCapabilities(intent: Intent, agent: AgentContext): string[] {
  const granted = new Set(agent.capabilities);
  return intent.requestedCapabilities.filter((capability) => !granted.has(capability));
}

function isSameIntent(intent: Intent, evaluated: EvaluatedIntent): boolean {
  return intent.id === evaluated.intentId
    && intent.type === evaluated.type
    && intent.target === evaluated.target
    && hasSameItems(intent.requestedCapabilities, evaluated.requestedCapabilities);
}

function hasSameItems(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
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

async function emitEvent(
  onEvent: EventListener | undefined,
  type: EventType,
  intentId: string,
  status: IntentStatus,
  metadata: Record<string, unknown>,
  decision?: Decision,
): Promise<void> {
  if (onEvent) await onEvent(createEvent(type, intentId, metadata, status, decision));
}

function toDecisionEventType(decision: Decision): EventType {
  switch (decision.outcome) {
    case "blocked":
      return "IntentBlocked";
    case "requires_approval":
      return "ApprovalRequired";
    default:
      return "IntentApproved";
  }
}

function toIntentStatus(decision: Decision): IntentStatus {
  return decision.outcome;
}

function createEvent(
  type: EventType,
  intentId: string,
  metadata: Record<string, unknown>,
  status: IntentStatus,
  decision?: Decision,
): Event {
  return {
    id: createId("event"),
    type,
    timestamp: new Date().toISOString(),
    intentId,
    status,
    decision,
    metadata,
  };
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizePayload(value: unknown): Record<string, JsonValue> {
  const sanitized = sanitizeJson(value);
  return isRecord(sanitized) ? sanitized : {};
}

function sanitizeJson(value: unknown): JsonValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) return value.map(sanitizeJson).filter((item) => item !== undefined) as JsonValue[];
  if (!isRecord(value)) return undefined;

  const output: Record<string, JsonValue> = {};
  for (const [key, item] of Object.entries(value)) {
    const sanitized = sanitizeJson(item);
    if (sanitized !== undefined) output[key] = sanitized;
  }
  return output;
}

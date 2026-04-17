import type { AgentContext, ApprovedCommand, Decision, DecisionInput, EventListener, EventType, Intent, IntentEvent, IntentGate, IntentGateConfig, JsonValue, Policy } from "./types.js";

const defaultFallbackDecision: Decision = { outcome: "approved" };
type EvaluatedIntent = {
  intentId: string;
  type: string;
  target: string;
  requestedCapabilities: string[];
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
    async evaluate(intent: TIntent): Promise<Decision> {
      validateIntent(intent);
      const intentId = intent.id ?? createId("intent");
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

      // Emit after evaluation so both generic and outcome-specific subscribers can react.
      await emitDecisionEvents(onEvent, intentId, decision, metadata);
      evaluatedDecisions.set(decision, {
        intentId,
        type: intent.type,
        target: intent.target,
        requestedCapabilities: [...intent.requestedCapabilities],
      });
      return decision;
    },
    toCommand(intent: TIntent, decision: Decision): ApprovedCommand {
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

function findMissingCapabilities(intent: Intent, agent: AgentContext): string[] {
  const granted = new Set(agent.capabilities);
  return intent.requestedCapabilities.filter((capability) => !granted.has(capability));
}

function isSameIntent(intent: Intent, evaluated: EvaluatedIntent): boolean {
  return (intent.id === undefined || intent.id === evaluated.intentId)
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

async function emitDecisionEvents(
  onEvent: EventListener | undefined,
  intentId: string,
  decision: Decision,
  metadata: Record<string, unknown>,
): Promise<void> {
  if (!onEvent) {
    return;
  }

  await onEvent(createEvent("IntentEvaluated", intentId, decision, metadata));
  await onEvent(createEvent(toDecisionEventType(decision), intentId, decision, metadata));
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

function createEvent(
  type: EventType,
  intentId: string,
  decision: Decision,
  metadata: Record<string, unknown>,
): IntentEvent {
  return {
    id: createId("event"),
    type,
    timestamp: new Date().toISOString(),
    intentId,
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

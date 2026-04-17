export type Intent<Metadata extends Record<string, unknown> = Record<string, unknown>> = {
  id?: string;
  type: string;
  target: string;
  requestedCapabilities: string[];
  metadata?: Metadata;
};

export type AgentContext = {
  agentId: string;
  capabilities: string[];
};

export type DecisionOutcome = "approved" | "blocked" | "requires_approval";
export type Decision = {
  outcome: DecisionOutcome;
  reason?: string;
  metadata?: Record<string, unknown>;
};
export type DecisionInput = DecisionOutcome | Decision;
export type EventType = "IntentEvaluated" | "IntentBlocked" | "IntentApproved" | "ApprovalRequired";
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type MaybePromise<T> = T | Promise<T>;

export type IntentEvent = {
  id: string;
  type: EventType;
  timestamp: string;
  intentId: string;
  decision: Decision;
  metadata: Record<string, unknown>;
};

export type EventListener = (event: IntentEvent) => MaybePromise<void>;
export type Policy<TIntent extends Intent = Intent> = {
  name?: string;
  match: (intent: TIntent) => MaybePromise<boolean>;
  evaluate: (intent: TIntent) => MaybePromise<DecisionInput>;
};
export type IntentGateConfig<TIntent extends Intent = Intent> = {
  agent: AgentContext;
  policies: Policy<TIntent>[];
  fallbackDecision?: DecisionInput;
  onEvent?: EventListener;
};
export type ApprovedCommand = {
  id: string;
  intentId: string;
  agentId: string;
  type: string;
  target: string;
  payload: Record<string, JsonValue>;
};
export type IntentGate<TIntent extends Intent = Intent> = {
  evaluate: (intent: TIntent) => Promise<Decision>;
  toCommand: (intent: TIntent, decision: Decision) => ApprovedCommand;
};

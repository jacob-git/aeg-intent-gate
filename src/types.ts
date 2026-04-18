export type Intent<Metadata extends Record<string, unknown> = Record<string, unknown>> = {
  id?: string;
  type: string;
  target: string;
  requestedCapabilities: string[];
  metadata?: Metadata;
};

export type IntentStatus = "proposed" | "evaluated" | "approved" | "blocked" | "requires_approval";

export type ManagedIntent<TIntent extends Intent = Intent> = TIntent & {
  id: string;
  status: IntentStatus;
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
export type EventType = "IntentProposed" | "IntentEvaluated" | "IntentBlocked" | "IntentApproved" | "ApprovalRequired";
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type MaybePromise<T> = T | Promise<T>;

export type Event = {
  id: string;
  type: EventType;
  timestamp: string;
  intentId: string;
  status: IntentStatus;
  decision?: Decision;
  metadata: Record<string, unknown>;
};

export type EventListener = (event: Event) => MaybePromise<void>;
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
  proposeIntent: (intent: TIntent) => Promise<ManagedIntent<TIntent>>;
  evaluateIntent: (intent: ManagedIntent<TIntent>) => Promise<Decision>;
  toCommand: (intent: ManagedIntent<TIntent>, decision: Decision) => ApprovedCommand;
};

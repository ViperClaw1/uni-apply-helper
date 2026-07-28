export type FormFillMode = 'schema' | 'agent' | 'hybrid';

export type AgentActionType =
  | 'fill'
  | 'click'
  | 'select'
  | 'check'
  | 'upload'
  | 'wait'
  | 'done'
  | 'fail';

export interface AgentActionTarget {
  role?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  selector?: string;
}

export interface AgentAction {
  type: AgentActionType;
  target?: AgentActionTarget;
  value?: string;
  /** Local path or remote URL for type=upload (falls back to value). */
  filePath?: string;
  reason?: string;
}

export interface AgentObservation {
  url: string;
  title: string;
  accessibilityTree: string;
  visibleText: string;
  screenshotBase64?: string;
}

export interface AgentFieldHint {
  mapsTo: string | string[] | null;
  label: string;
  type: string;
  value: string;
  required: boolean;
  selector?: string;
  labelHint?: string;
}

export interface AgentContext {
  goal: string;
  universityName: string;
  pendingFields: AgentFieldHint[];
  previousActions: AgentAction[];
}

export interface AgentDecision {
  action: AgentAction;
  confidence?: number;
  useVision?: boolean;
}

export interface AgentStepResult {
  action: AgentAction;
  success: boolean;
  error?: string;
}

export interface AgentConfig {
  fillMode?: FormFillMode;
  goal?: string;
  maxSteps?: number;
  useVision?: boolean;
  /**
   * When true (or AGENT_FALLBACK=1), schema/hybrid path failures fall back to
   * FormAgent.runWizard once. Default false — no prod behavior change.
   */
  fallbackEnabled?: boolean;
}

export interface AgentLoopResult {
  completed: boolean;
  steps: AgentStepResult[];
  finalAction?: AgentAction;
}

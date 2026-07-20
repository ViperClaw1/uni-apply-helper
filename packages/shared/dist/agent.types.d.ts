export type FormFillMode = 'schema' | 'agent' | 'hybrid';
export type AgentActionType = 'fill' | 'click' | 'select' | 'check' | 'upload' | 'wait' | 'done' | 'fail';
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
    mapsTo: string | null;
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
}
export interface AgentLoopResult {
    completed: boolean;
    steps: AgentStepResult[];
    finalAction?: AgentAction;
}

// Agent 类型定义

export type AgentStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export interface AgentState {
  id: string;
  status: AgentStatus;
  currentStep: number;
  totalSteps: number;
  actions: AgentAction[];
  errors: AgentError[];
}

export type AgentActionType =
  | 'fill'
  | 'click'
  | 'select'
  | 'wait'
  | 'navigate'
  | 'verify'
  | 'submit';

export interface AgentAction {
  type: AgentActionType;
  target?: string; // CSS 选择器或描述
  value?: string;
  condition?: WaitCondition;
  timeout?: number;
  maxRetries?: number;
}

export interface WaitCondition {
  type: 'element' | 'url' | 'time' | 'custom';
  selector?: string;
  urlPattern?: string;
  duration?: number;
  customCheck?: string;
}

export interface AgentError {
  step: number;
  action: AgentActionType;
  message: string;
  timestamp: number;
}

export interface AgentContext {
  pageUrl: string;
  pageTitle: string;
  formType?: string;
  previousActions: CompletedAction[];
}

export interface CompletedAction {
  action: AgentAction;
  result: 'success' | 'skipped' | 'failed';
  timestamp: number;
}

// Agent 配置
export interface AgentConfig {
  enabled: boolean;
  maxSteps: number;
  autoNavigate: boolean;
  fillDelay: number; // ms
  retryDelay: number; // ms
}
// 扩展消息类型定义

export type MessageType =
  // 档案管理
  | 'GET_PROFILES'
  | 'SAVE_PROFILE'
  | 'DELETE_PROFILE'
  | 'SET_DEFAULT_PROFILE'
  // 表单操作
  | 'DETECT_FORMS'
  | 'FILL_FORM'
  | 'GET_FILL_PREVIEW'
  // 设置
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'TEST_API'
  // Agent
  | 'START_AGENT'
  | 'STOP_AGENT'
  | 'GET_AGENT_STATUS';

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
  tabId?: number;
}

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 具体消息 Payload 类型
export interface FillFormPayload {
  profileId: string;
  fieldMatches?: FieldMatchPayload[];
}

export interface FieldMatchPayload {
  fieldId: string;
  value: string;
}

export interface StartAgentPayload {
  profileId: string;
  maxSteps?: number;
}

// 响应数据类型
export interface DetectFormsResponse {
  forms: FormFieldInfo[];
  totalCount: number;
}

export interface FormFieldInfo {
  id: string;
  label: string;
  type: string;
  suggestedMatch?: {
    profileKey: string;
    value: string;
    confidence: number;
  };
}
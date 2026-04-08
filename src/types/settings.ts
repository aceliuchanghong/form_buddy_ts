// 设置类型定义

import { AgentConfig } from './agent';

export interface ExtensionSettings {
  api: {
    provider: 'openai' | 'anthropic' | 'custom';
    apiKey: string;
    baseUrl?: string;
    model: string;
  };
  fill: {
    autoFill: boolean;
    showConfirmation: boolean;
    confidenceThreshold: number;
    fillDelay: number;
  };
  agent: AgentConfig;
  privacy: {
    encryptSensitiveData: boolean;
    autoClearAfter: number;
  };
}
// 设置存储

import { AgentConfig } from '../../types/agent';
import { ExtensionSettings } from '../../types/settings';
import { encrypt, decrypt, isEncrypted } from '../crypto';

export type { ExtensionSettings };

const SETTINGS_KEY = 'form_buddy_settings';

const DEFAULT_SETTINGS: ExtensionSettings = {
  api: {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
  },
  fill: {
    autoFill: false,
    showConfirmation: true,
    confidenceThreshold: 0.8,
    fillDelay: 100,
  },
  agent: {
    enabled: true,
    maxSteps: 50,
    autoNavigate: true,
    fillDelay: 200,
    retryDelay: 1000,
  },
  privacy: {
    encryptSensitiveData: true,
    autoClearAfter: 0,
  },
};

/**
 * 获取设置
 */
export async function getSettings(): Promise<ExtensionSettings> {
  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    const settings = (result[SETTINGS_KEY] || {}) as Partial<ExtensionSettings>;

    // 合并默认值
    const merged = deepMerge(DEFAULT_SETTINGS as unknown as Record<string, unknown>, settings as unknown as Record<string, unknown>);

    // 解密 API Key
    const finalSettings = merged as unknown as ExtensionSettings;
    if (finalSettings.api?.apiKey && isEncrypted(finalSettings.api.apiKey)) {
      try {
        finalSettings.api.apiKey = await decrypt(finalSettings.api.apiKey);
      } catch {
        // 解密失败，清空
        finalSettings.api.apiKey = '';
      }
    }

    return finalSettings;
  } catch (error) {
    console.error('Failed to get settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * 保存设置
 */
export async function saveSettings(
  settings: Partial<ExtensionSettings>
): Promise<void> {
  const current = await getSettings();
  const merged = deepMerge(
    current as unknown as Record<string, unknown>,
    settings as unknown as Record<string, unknown>
  ) as unknown as ExtensionSettings;

  // 加密 API Key
  if (merged.api?.apiKey && !isEncrypted(merged.api.apiKey)) {
    merged.api.apiKey = await encrypt(merged.api.apiKey);
  }

  await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
}

/**
 * 更新 API Key
 */
export async function setApiKey(
  apiKey: string,
  provider: 'openai' | 'anthropic' | 'custom' = 'openai'
): Promise<void> {
  const settings = await getSettings();
  settings.api.apiKey = apiKey;
  settings.api.provider = provider;
  await saveSettings(settings);
}

/**
 * 检查是否已配置 API Key
 */
export async function hasApiKey(): Promise<boolean> {
  const settings = await getSettings();
  return !!settings.api?.apiKey;
}

/**
 * 重置设置为默认值
 */
export async function resetSettings(): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
}

// 深度合并辅助函数
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(
          result[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
      } else {
        result[key] = source[key] as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}
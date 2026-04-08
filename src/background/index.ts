// Background Service Worker 入口

import { ExtensionMessage, ExtensionResponse } from '../types/message';

// 监听来自 popup 和 content script 的消息
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('Background message handler error:', error);
      sendResponse({ success: false, error: error.message });
    });

  // 返回 true 表示异步响应
  return true;
});

/**
 * 处理消息
 */
async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'GET_PROFILES':
      return handleGetProfiles();

    case 'SAVE_PROFILE':
      return handleSaveProfile(message.payload as { id?: string; name?: string; data?: any });

    case 'DELETE_PROFILE':
      return handleDeleteProfile(message.payload as { id: string });

    case 'SET_DEFAULT_PROFILE':
      return handleSetDefaultProfile(message.payload as { id: string });

    case 'GET_SETTINGS':
      return handleGetSettings();

    case 'SAVE_SETTINGS':
      return handleSaveSettings(message.payload as Partial<import('../types/settings').ExtensionSettings>);

    case 'TEST_API':
      return handleTestApi(message.payload as { provider: string; apiKey: string; baseUrl?: string; model: string });

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

// 动态导入存储模块
async function handleGetProfiles(): Promise<ExtensionResponse> {
  const { getProfiles } = await import('../core/storage/profileStore');
  const profiles = await getProfiles();
  return { success: true, data: profiles };
}

async function handleSaveProfile(payload: any): Promise<ExtensionResponse> {
  const { saveProfile } = await import('../core/storage/profileStore');
  await saveProfile(payload);
  return { success: true };
}

async function handleDeleteProfile(payload: { id: string }): Promise<ExtensionResponse> {
  const { deleteProfile } = await import('../core/storage/profileStore');
  await deleteProfile(payload.id);
  return { success: true };
}

async function handleSetDefaultProfile(payload: { id: string }): Promise<ExtensionResponse> {
  const { setDefaultProfile } = await import('../core/storage/profileStore');
  await setDefaultProfile(payload.id);
  return { success: true };
}

async function handleGetSettings(): Promise<ExtensionResponse> {
  const { getSettings } = await import('../core/storage/settingsStore');
  const settings = await getSettings();
  return { success: true, data: settings };
}

async function handleSaveSettings(payload: any): Promise<ExtensionResponse> {
  const { saveSettings } = await import('../core/storage/settingsStore');
  await saveSettings(payload);
  return { success: true };
}

async function handleTestApi(payload: {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
}): Promise<ExtensionResponse> {
  try {
    const { OpenAIService } = await import('../core/ai/openai');
    const service = new OpenAIService(payload.apiKey, payload.baseUrl);

    // 发送测试请求
    const result = await service.testConnection();

    return { success: result, error: result ? undefined : 'API 测试失败' };
  } catch (error: any) {
    return { success: false, error: error.message || 'API 测试失败' };
  }
}

// 扩展安装/更新时的处理
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 首次安装，打开设置页面
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    console.log('Extension updated to version', chrome.runtime.getManifest().version);
  }
});

// 快捷键命令处理
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'fill-form') {
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // 发送填充命令到 content script
      chrome.tabs.sendMessage(tab.id, { type: 'FILL_FORM' });
    }
  }
});

console.log('[Form Buddy] Background service worker started');
// Content Script 入口

import { detectForms, clearAllHighlights, highlightField } from './formDetector';
import { ruleBasedMatch, fillForm, fillField } from './fieldMatcher';
import { FormField, FieldMatch } from '../types/form';
import { getProfile, getDefaultProfile } from '../core/storage/profileStore';

// 存储检测到的字段
let detectedFields: FormField[] = [];

// 监听来自 background 和 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      console.error('Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    });

  // 返回 true 表示异步响应
  return true;
});

/**
 * 处理消息
 */
async function handleMessage(
  message: { type: string; payload?: any }
): Promise<{ success: boolean; data?: any; error?: string }> {
  switch (message.type) {
    case 'DETECT_FORMS':
      return handleDetectForms();

    case 'FILL_FORM':
      return handleFillForm(message.payload);

    case 'GET_FILL_PREVIEW':
      return handlePreview(message.payload);

    case 'CLEAR_HIGHLIGHTS':
      clearAllHighlights();
      return { success: true };

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

/**
 * 处理表单检测
 */
function handleDetectForms(): { success: boolean; data: any } {
  detectedFields = detectForms();

  return {
    success: true,
    data: {
      totalCount: detectedFields.length,
      fields: detectedFields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        name: f.name,
        required: f.required,
      })),
    },
  };
}

/**
 * 处理表单填充
 */
async function handleFillForm(payload: {
  profileId?: string;
  fieldMatches?: FieldMatch[];
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // 获取档案
    const profile = payload.profileId
      ? await getProfile(payload.profileId)
      : await getDefaultProfile();

    if (!profile) {
      return { success: false, error: '请先创建用户档案' };
    }

    // 如果没有检测过字段，先检测
    if (detectedFields.length === 0) {
      detectedFields = detectForms();
    }

    if (detectedFields.length === 0) {
      return { success: false, error: '未检测到可填充的字段' };
    }

    // 执行匹配
    const matches = ruleBasedMatch(detectedFields, profile.data);

    if (matches.length === 0) {
      return { success: false, error: '未找到匹配的字段' };
    }

    // 执行填充
    const result = fillForm(detectedFields, matches);

    return {
      success: true,
      data: {
        total: detectedFields.length,
        matched: matches.length,
        filled: result.success,
        failed: result.failed,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || '填充失败' };
  }
}

/**
 * 处理预览
 */
async function handlePreview(payload: {
  profileId?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const profile = payload.profileId
      ? await getProfile(payload.profileId)
      : await getDefaultProfile();

    if (!profile) {
      return { success: false, error: '请先创建用户档案' };
    }

    // 检测字段
    detectedFields = detectForms();

    if (detectedFields.length === 0) {
      return { success: false, error: '未检测到可填充的字段' };
    }

    // 执行匹配
    const matches = ruleBasedMatch(detectedFields, profile.data);

    // 高亮显示匹配的字段
    clearAllHighlights();
    for (const match of matches) {
      const field = detectedFields.find((f) => f.id === match.fieldId);
      if (field) {
        highlightField(field, match.confidence > 0.9 ? '#4CAF50' : '#FFC107');
      }
    }

    return {
      success: true,
      data: {
        fields: detectedFields,
        matches: matches.map((m) => ({
          fieldId: m.fieldId,
          profileKey: m.profileKey,
          value: m.value,
          confidence: m.confidence,
        })),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || '预览失败' };
  }
}

// 页面加载完成后检测表单
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // 延迟检测，等待动态内容加载
    setTimeout(() => {
      detectedFields = detectForms();
      console.log(`[Form Buddy] Detected ${detectedFields.length} form fields`);
    }, 500);
  });
} else {
  // 页面已加载
  setTimeout(() => {
    detectedFields = detectForms();
    console.log(`[Form Buddy] Detected ${detectedFields.length} form fields`);
  }, 500);
}

// 监听 DOM 变化，检测动态加载的表单
const observer = new MutationObserver((mutations) => {
  let shouldRescan = false;

  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof HTMLElement) {
          if (node.querySelector('input, select, textarea') ||
              ['INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName)) {
            shouldRescan = true;
            break;
          }
        }
      }
    }
  }

  if (shouldRescan) {
    // 防抖
    clearTimeout((window as any).__formBuddyRescanTimer);
    (window as any).__formBuddyRescanTimer = setTimeout(() => {
      detectedFields = detectForms();
    }, 300);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
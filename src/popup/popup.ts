// Popup 脚本入口

import { getProfiles, getDefaultProfile } from '../core/storage/profileStore';
import { getSettings, hasApiKey } from '../core/storage/settingsStore';
import { UserProfile } from '../types/profile';
import './popup.css';

interface PopupState {
  profiles: UserProfile[];
  selectedProfileId: string;
  fieldCount: number;
  hasApiKey: boolean;
  agentEnabled: boolean;
}

const state: PopupState = {
  profiles: [],
  selectedProfileId: '',
  fieldCount: 0,
  hasApiKey: false,
  agentEnabled: false,
};

// DOM 元素
const elements = {
  apiWarning: document.getElementById('apiWarning') as HTMLDivElement,
  fieldCount: document.getElementById('fieldCount') as HTMLDivElement,
  profileSelect: document.getElementById('profileSelect') as HTMLSelectElement,
  agentToggle: document.getElementById('agentToggle') as HTMLInputElement,
  fillBtn: document.getElementById('fillBtn') as HTMLButtonElement,
  previewBtn: document.getElementById('previewBtn') as HTMLButtonElement,
  settingsBtn: document.getElementById('settingsBtn') as HTMLButtonElement,
};

// 初始化
async function init() {
  // 检查 API Key
  state.hasApiKey = await hasApiKey();
  updateApiWarning();

  // 加载用户档案
  await loadProfiles();

  // 获取当前标签页的表单信息
  await detectForms();

  // 绑定事件
  bindEvents();
}

// 加载用户档案列表
async function loadProfiles() {
  try {
    const profiles = await getProfiles();
    state.profiles = profiles;

    // 渲染档案选择器
    elements.profileSelect.innerHTML =
      '<option value="">选择用户档案...</option>';

    profiles.forEach((profile) => {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.name + (profile.isDefault ? ' (默认)' : '');
      elements.profileSelect.appendChild(option);
    });

    // 默认选中第一个
    const defaultProfile = await getDefaultProfile();
    if (defaultProfile) {
      elements.profileSelect.value = defaultProfile.id;
      state.selectedProfileId = defaultProfile.id;
    }

    updateFillButton();
  } catch (error) {
    console.error('Failed to load profiles:', error);
  }
}

// 检测当前页面的表单
async function detectForms() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      elements.fieldCount.textContent = '-';
      return;
    }

    // 发送消息到 content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'DETECT_FORMS',
    });

    if (response?.success && response.data) {
      state.fieldCount = response.data.totalCount || 0;
      elements.fieldCount.textContent = state.fieldCount.toString();
    } else {
      // content script 未加载，显示提示
      elements.fieldCount.textContent = '刷新页面';
    }
  } catch (error) {
    // Content script 可能未注入
    console.log('Content script not ready:', error);
    elements.fieldCount.textContent = '刷新页面';
  }

  updateFillButton();
}

// 更新 API 警告显示
function updateApiWarning() {
  elements.apiWarning.style.display = state.hasApiKey ? 'none' : 'block';
  updateFillButton();
}

// 更新填充按钮状态
function updateFillButton() {
  const canFill =
    state.hasApiKey &&
    state.selectedProfileId &&
    state.fieldCount > 0;

  elements.fillBtn.disabled = !canFill;
}

// 绑定事件
function bindEvents() {
  // 档案选择
  elements.profileSelect.addEventListener('change', (e) => {
    state.selectedProfileId = (e.target as HTMLSelectElement).value;
    updateFillButton();
  });

  // Agent 模式切换
  elements.agentToggle.addEventListener('change', (e) => {
    state.agentEnabled = (e.target as HTMLInputElement).checked;
  });

  // 填充按钮
  elements.fillBtn.addEventListener('click', handleFill);

  // 预览按钮
  elements.previewBtn.addEventListener('click', handlePreview);

  // 设置按钮
  elements.settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

// 处理填充
async function handleFill() {
  if (!state.selectedProfileId || state.fieldCount === 0) {
    return;
  }

  try {
    elements.fillBtn.disabled = true;
    elements.fillBtn.textContent = '填充中...';

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) return;

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'FILL_FORM',
      payload: {
        profileId: state.selectedProfileId,
        useAgent: state.agentEnabled,
      },
    });

    if (response?.success) {
      elements.fillBtn.textContent = '填充完成 ✓';
      setTimeout(() => {
        elements.fillBtn.textContent = '智能填充';
        updateFillButton();
      }, 2000);
    } else {
      elements.fillBtn.textContent = '填充失败';
      setTimeout(() => {
        elements.fillBtn.textContent = '智能填充';
        updateFillButton();
      }, 2000);
    }
  } catch (error) {
    console.error('Fill failed:', error);
    elements.fillBtn.textContent = '填充失败';
    setTimeout(() => {
      elements.fillBtn.textContent = '智能填充';
      updateFillButton();
    }, 2000);
  }
}

// 处理预览
async function handlePreview() {
  if (!state.selectedProfileId) {
    alert('请先选择用户档案');
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) return;

    await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_FILL_PREVIEW',
      payload: {
        profileId: state.selectedProfileId,
      },
    });
  } catch (error) {
    console.error('Preview failed:', error);
  }
}

// 启动
init();
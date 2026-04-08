// Options 页面脚本

import {
  getProfiles,
  getProfile,
  saveProfile,
  deleteProfile,
  setDefaultProfile,
  createNewProfile,
} from '../core/storage/profileStore';
import { getSettings, saveSettings, hasApiKey } from '../core/storage/settingsStore';
import { UserProfile } from '../types/profile';

let currentEditingId: string | null = null;

// 初始化
async function init() {
  await loadApiConfig();
  await loadProfiles();
  bindEvents();
}

// 加载 API 配置
async function loadApiConfig() {
  const settings = await getSettings();
  const hasKey = await hasApiKey();

  // 更新状态显示
  const statusEl = document.getElementById('apiStatus') as HTMLDivElement;
  const statusText = document.getElementById('apiStatusText') as HTMLSpanElement;

  if (hasKey) {
    statusEl.classList.add('connected');
    statusText.textContent = '已配置';
  } else {
    statusEl.classList.remove('connected');
    statusText.textContent = '未配置';
  }

  // 填充表单
  const providerSelect = document.getElementById('apiProvider') as HTMLSelectElement;
  const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
  const baseUrlInput = document.getElementById('baseUrl') as HTMLInputElement;
  const modelSelect = document.getElementById('model') as HTMLSelectElement;

  providerSelect.value = settings.api.provider;
  apiKeyInput.value = settings.api.apiKey;
  modelSelect.value = settings.api.model;

  if (settings.api.baseUrl) {
    baseUrlInput.value = settings.api.baseUrl;
  }

  // 显示/隐藏 Base URL
  toggleBaseUrlField(settings.api.provider);

  // 更新模型选项
  updateModelOptions(settings.api.provider);
}

// 加载档案列表
async function loadProfiles() {
  const profiles = await getProfiles();
  const listEl = document.getElementById('profileList') as HTMLUListElement;
  const emptyEl = document.getElementById('emptyState') as HTMLDivElement;

  if (profiles.length === 0) {
    listEl.style.display = 'none';
    emptyEl.style.display = 'block';
    return;
  }

  listEl.style.display = 'block';
  emptyEl.style.display = 'none';

  listEl.innerHTML = profiles
    .map(
      (p) => `
    <li class="profile-item">
      <div class="profile-info">
        <span class="profile-name">${escapeHtml(p.name)}</span>
        ${p.isDefault ? '<span class="profile-badge">默认</span>' : ''}
      </div>
      <div class="profile-actions">
        <button class="btn btn-secondary" onclick="editProfile('${p.id}')">编辑</button>
        ${!p.isDefault ? `<button class="btn btn-secondary" onclick="setDefault('${p.id}')">设为默认</button>` : ''}
        ${!p.isDefault ? `<button class="btn btn-danger" onclick="removeProfile('${p.id}')">删除</button>` : ''}
      </div>
    </li>
  `
    )
    .join('');
}

// 绑定事件
function bindEvents() {
  // API Provider 变更
  const providerSelect = document.getElementById('apiProvider') as HTMLSelectElement;
  providerSelect.addEventListener('change', (e) => {
    const provider = (e.target as HTMLSelectElement).value;
    toggleBaseUrlField(provider);
    updateModelOptions(provider);
  });

  // 保存 API 配置
  document
    .getElementById('saveApiBtn')
    ?.addEventListener('click', saveApiConfig);

  // 测试 API 连接
  document
    .getElementById('testApiBtn')
    ?.addEventListener('click', testApiConnection);

  // 添加档案
  document
    .getElementById('addProfileBtn')
    ?.addEventListener('click', () => editProfile(null));
  document
    .getElementById('createFirstBtn')
    ?.addEventListener('click', () => editProfile(null));

  // Tab 切换
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const tabId = (e.target as HTMLButtonElement).dataset.tab;
      switchTab(tabId || 'basic');
    });
  });

  // 保存档案
  document
    .getElementById('saveProfileBtn')
    ?.addEventListener('click', saveProfileBtn);

  // 取消编辑
  document
    .getElementById('cancelEditBtn')
    ?.addEventListener('click', cancelEdit);

  // 删除档案
  document
    .getElementById('deleteProfileBtn')
    ?.addEventListener('click', deleteCurrentProfile);

  // 置信度滑块
  const thresholdSlider = document.getElementById(
    'confidenceThreshold'
  ) as HTMLInputElement;
  thresholdSlider?.addEventListener('input', (e) => {
    const value = (e.target as HTMLInputElement).value;
    document.getElementById('confidenceValue')!.textContent = value + '%';
  });

  // 保存设置
  // (自动保存在离开时)
}

// 切换 Base URL 显示
function toggleBaseUrlField(provider: string) {
  const baseUrlGroup = document.getElementById('baseUrlGroup') as HTMLDivElement;
  baseUrlGroup.style.display = provider === 'custom' ? 'block' : 'none';
}

// 更新模型选项
function updateModelOptions(provider: string) {
  const modelSelect = document.getElementById('model') as HTMLSelectElement;

  const models: Record<string, { value: string; label: string }[]> = {
    openai: [
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (推荐)' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
    anthropic: [
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    ],
    custom: [{ value: 'custom', label: '自定义模型' }],
  };

  modelSelect.innerHTML = (models[provider] || models.openai)
    .map((m) => `<option value="${m.value}">${m.label}</option>`)
    .join('');
}

// 保存 API 配置
async function saveApiConfig() {
  const provider = (
    document.getElementById('apiProvider') as HTMLSelectElement
  ).value as 'openai' | 'anthropic' | 'custom';
  const apiKey = (document.getElementById('apiKey') as HTMLInputElement).value;
  const baseUrl = (document.getElementById('baseUrl') as HTMLInputElement).value;
  const model = (document.getElementById('model') as HTMLSelectElement).value;

  if (!apiKey) {
    alert('请输入 API Key');
    return;
  }

  try {
    await saveSettings({
      api: {
        provider,
        apiKey,
        baseUrl: baseUrl || undefined,
        model,
      },
    });

    // 更新状态
    const statusEl = document.getElementById('apiStatus') as HTMLDivElement;
    const statusText = document.getElementById('apiStatusText') as HTMLSpanElement;
    statusEl.classList.add('connected');
    statusText.textContent = '已配置';

    alert('API 配置已保存');
  } catch (error) {
    console.error('Failed to save API config:', error);
    alert('保存失败');
  }
}

// 测试 API 连接
async function testApiConnection() {
  const provider = (document.getElementById('apiProvider') as HTMLSelectElement).value;
  const apiKey = (document.getElementById('apiKey') as HTMLInputElement).value;
  const baseUrl = (document.getElementById('baseUrl') as HTMLInputElement).value;
  const model = (document.getElementById('model') as HTMLSelectElement).value;

  if (!apiKey) {
    alert('请先输入 API Key');
    return;
  }

  const testBtn = document.getElementById('testApiBtn') as HTMLButtonElement;
  testBtn.disabled = true;
  testBtn.textContent = '测试中...';

  try {
    // 发送到 background 进行测试
    const response = await chrome.runtime.sendMessage({
      type: 'TEST_API',
      payload: { provider, apiKey, baseUrl, model },
    });

    if (response.success) {
      alert('API 连接成功！');
    } else {
      alert('API 连接失败: ' + (response.error || '未知错误'));
    }
  } catch (error) {
    console.error('API test failed:', error);
    alert('测试请求失败');
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = '测试连接';
  }
}

// 编辑档案
async function editProfile(id: string | null) {
  currentEditingId = id;

  const panel = document.getElementById('profileEditPanel') as HTMLDivElement;
  const title = document.getElementById('editPanelTitle') as HTMLHeadingElement;
  const deleteBtn = document.getElementById(
    'deleteProfileBtn'
  ) as HTMLButtonElement;

  panel.style.display = 'block';

  if (id) {
    title.textContent = '编辑档案';
    deleteBtn.style.display = 'inline-block';

    const profile = await getProfile(id);
    if (profile) {
      fillProfileForm(profile);
    }
  } else {
    title.textContent = '添加档案';
    deleteBtn.style.display = 'none';
    clearProfileForm();
  }

  // 滚动到编辑面板
  panel.scrollIntoView({ behavior: 'smooth' });
}

// 填充档案表单
function fillProfileForm(profile: UserProfile) {
  (
    document.getElementById('profileName') as HTMLInputElement
  ).value = profile.name;
  (document.getElementById('name') as HTMLInputElement).value =
    profile.data.basic.name;
  (document.getElementById('gender') as HTMLSelectElement).value =
    profile.data.basic.gender;
  (document.getElementById('birthday') as HTMLInputElement).value =
    profile.data.basic.birthday;
  (document.getElementById('nationality') as HTMLInputElement).value =
    profile.data.basic.nationality;
  (document.getElementById('ethnicity') as HTMLInputElement).value =
    profile.data.basic.ethnicity || '';

  // 证件信息
  (document.getElementById('idCardType') as HTMLSelectElement).value =
    profile.data.identity.idCardType;
  (document.getElementById('idCardNumber') as HTMLInputElement).value =
    profile.data.identity.idCardNumber;

  // 联系方式
  (document.getElementById('phone') as HTMLInputElement).value =
    profile.data.contact.phone;
  (document.getElementById('email') as HTMLInputElement).value =
    profile.data.contact.email || '';
  (document.getElementById('wechat') as HTMLInputElement).value =
    profile.data.contact.wechat || '';

  // 地址信息
  (document.getElementById('province') as HTMLInputElement).value =
    profile.data.address.province;
  (document.getElementById('city') as HTMLInputElement).value =
    profile.data.address.city;
  (document.getElementById('district') as HTMLInputElement).value =
    profile.data.address.district;
  (document.getElementById('addressDetail') as HTMLTextAreaElement).value =
    profile.data.address.detail;
  (document.getElementById('postalCode') as HTMLInputElement).value =
    profile.data.address.postalCode || '';

  // 工作学历
  if (profile.data.work) {
    (document.getElementById('company') as HTMLInputElement).value =
      profile.data.work.company;
    (document.getElementById('position') as HTMLInputElement).value =
      profile.data.work.position;
    (document.getElementById('workPhone') as HTMLInputElement).value =
      profile.data.work.phone || '';
  }

  if (profile.data.education) {
    (document.getElementById('degree') as HTMLSelectElement).value =
      profile.data.education.degree;
    (document.getElementById('school') as HTMLInputElement).value =
      profile.data.education.school;
    (document.getElementById('major') as HTMLInputElement).value =
      profile.data.education.major || '';
  }
}

// 清空档案表单
function clearProfileForm() {
  const inputs = document.querySelectorAll(
    '#profileEditPanel input, #profileEditPanel select, #profileEditPanel textarea'
  );
  inputs.forEach((el) => {
    if ((el as HTMLInputElement).type === 'checkbox') {
      (el as HTMLInputElement).checked = false;
    } else {
      (el as HTMLInputElement).value = '';
    }
  });

  // 设置默认值
  (document.getElementById('nationality') as HTMLInputElement).value = '中国';
  (document.getElementById('gender') as HTMLSelectElement).value = 'male';
  (document.getElementById('idCardType') as HTMLSelectElement).value = 'id_card';
}

// 保存档案按钮处理
async function saveProfileBtn() {
  const profileName = (
    document.getElementById('profileName') as HTMLInputElement
  ).value;
  const name = (document.getElementById('name') as HTMLInputElement).value;

  if (!profileName || !name) {
    alert('请至少填写档案名称和姓名');
    return;
  }

  try {
    const profile = currentEditingId
      ? await getProfile(currentEditingId)
      : null;

    const newProfile: UserProfile = profile || {
      id: generateId(),
      name: '',
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: {} as any,
    };

    // 更新基本信息
    newProfile.name = profileName;
    newProfile.updatedAt = Date.now();
    newProfile.data = {
      basic: {
        name,
        gender: (document.getElementById('gender') as HTMLSelectElement)
          .value as any,
        birthday: (document.getElementById('birthday') as HTMLInputElement)
          .value,
        nationality: (
          document.getElementById('nationality') as HTMLInputElement
        ).value,
        ethnicity: (document.getElementById('ethnicity') as HTMLInputElement)
          .value,
      },
      identity: {
        idCardType: (document.getElementById('idCardType') as HTMLSelectElement)
          .value as any,
        idCardNumber: (
          document.getElementById('idCardNumber') as HTMLInputElement
        ).value,
      },
      contact: {
        phone: (document.getElementById('phone') as HTMLInputElement).value,
        email: (document.getElementById('email') as HTMLInputElement).value,
        wechat: (document.getElementById('wechat') as HTMLInputElement).value,
      },
      address: {
        province: (document.getElementById('province') as HTMLInputElement)
          .value,
        city: (document.getElementById('city') as HTMLInputElement).value,
        district: (document.getElementById('district') as HTMLInputElement)
          .value,
        detail: (
          document.getElementById('addressDetail') as HTMLTextAreaElement
        ).value,
        postalCode: (
          document.getElementById('postalCode') as HTMLInputElement
        ).value,
      },
      work: {
        company: (document.getElementById('company') as HTMLInputElement).value,
        position: (document.getElementById('position') as HTMLInputElement).value,
        phone: (document.getElementById('workPhone') as HTMLInputElement).value,
      },
      education: {
        degree: (document.getElementById('degree') as HTMLSelectElement).value,
        school: (document.getElementById('school') as HTMLInputElement).value,
        major: (document.getElementById('major') as HTMLInputElement).value,
      },
    };

    // 如果是第一个档案，设为默认
    const profiles = await getProfiles();
    if (profiles.length === 0) {
      newProfile.isDefault = true;
    }

    await saveProfile(newProfile);

    // 重新加载列表
    await loadProfiles();

    // 隐藏编辑面板
    document.getElementById('profileEditPanel')!.style.display = 'none';
    currentEditingId = null;

    alert('档案已保存');
  } catch (error) {
    console.error('Failed to save profile:', error);
    alert('保存失败');
  }
}

// 取消编辑
function cancelEdit() {
  document.getElementById('profileEditPanel')!.style.display = 'none';
  currentEditingId = null;
}

// 删除当前档案
async function deleteCurrentProfile() {
  if (!currentEditingId) return;

  if (!confirm('确定要删除此档案吗？')) return;

  try {
    await deleteProfile(currentEditingId);
    await loadProfiles();
    cancelEdit();
  } catch (error) {
    console.error('Failed to delete profile:', error);
    alert('删除失败');
  }
}

// 设置默认档案
async function setDefault(id: string) {
  try {
    await setDefaultProfile(id);
    await loadProfiles();
  } catch (error) {
    console.error('Failed to set default:', error);
  }
}

// 删除档案
async function removeProfile(id: string) {
  if (!confirm('确定要删除此档案吗？')) return;

  try {
    await deleteProfile(id);
    await loadProfiles();
  } catch (error) {
    console.error('Failed to delete profile:', error);
  }
}

// 切换 Tab
function switchTab(tabId: string) {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', (tab as HTMLButtonElement).dataset.tab === tabId);
  });

  document.querySelectorAll('.tab-content').forEach((content) => {
    content.classList.toggle(
      'active',
      content.id === `tab-${tabId}`
    );
  });
}

// 生成 ID
function generateId(): string {
  return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// HTML 转义
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 暴露全局函数
(window as any).editProfile = editProfile;
(window as any).setDefault = setDefault;
(window as any).removeProfile = removeProfile;

// 启动
init();
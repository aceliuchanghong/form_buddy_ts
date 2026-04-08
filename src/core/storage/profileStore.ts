// 用户档案存储

import { UserProfile, ProfileData, createDefaultProfile } from '../../types/profile';
import { encryptSensitiveFields, decryptSensitiveFields } from '../crypto';

const STORAGE_KEY = 'form_buddy_profiles';
const SENSITIVE_KEYS = ['identity.idCardNumber'];

/**
 * 获取所有用户档案
 */
export async function getProfiles(): Promise<UserProfile[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return (result[STORAGE_KEY] as UserProfile[] | undefined) || [];
  } catch (error) {
    console.error('Failed to get profiles:', error);
    return [];
  }
}

/**
 * 获取单个用户档案
 */
export async function getProfile(id: string): Promise<UserProfile | null> {
  const profiles = await getProfiles();
  const found = profiles.find((p) => p.id === id);

  if (!found) {
    return null;
  }

  // 解密敏感字段
  const decrypted = await decryptSensitiveFields(found as unknown as Record<string, unknown>, SENSITIVE_KEYS);
  return decrypted as unknown as UserProfile;
}

/**
 * 获取默认档案
 */
export async function getDefaultProfile(): Promise<UserProfile | null> {
  const profiles = await getProfiles();
  const found = profiles.find((p) => p.isDefault) || profiles[0];

  if (!found) {
    return null;
  }

  // 解密敏感字段
  const decrypted = await decryptSensitiveFields(found as unknown as Record<string, unknown>, SENSITIVE_KEYS);
  return decrypted as unknown as UserProfile;
}

/**
 * 保存用户档案
 */
export async function saveProfile(profile: UserProfile): Promise<void> {
  const profiles = await getProfiles();

  // 加密敏感字段
  const encryptedProfile = await encryptSensitiveFields(
    profile as unknown as Record<string, unknown>,
    SENSITIVE_KEYS
  );

  const existingIndex = profiles.findIndex((p) => p.id === profile.id);

  if (existingIndex >= 0) {
    profiles[existingIndex] = encryptedProfile as unknown as UserProfile;
  } else {
    profiles.push(encryptedProfile as unknown as UserProfile);
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: profiles });
}

/**
 * 删除用户档案
 */
export async function deleteProfile(id: string): Promise<void> {
  const profiles = await getProfiles();
  const filtered = profiles.filter((p) => p.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
}

/**
 * 设置默认档案
 */
export async function setDefaultProfile(id: string): Promise<void> {
  const profiles = await getProfiles();

  for (const profile of profiles) {
    profile.isDefault = profile.id === id;
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: profiles });
}

/**
 * 创建新的空白档案
 */
export async function createNewProfile(name?: string): Promise<UserProfile> {
  const profile = createDefaultProfile();
  if (name) {
    profile.name = name;
  }
  await saveProfile(profile);
  return profile;
}

/**
 * 确保至少有一个档案存在
 */
export async function ensureDefaultProfile(): Promise<UserProfile> {
  let profile = await getDefaultProfile();
  if (!profile) {
    profile = await createNewProfile('默认档案');
  }
  return profile;
}
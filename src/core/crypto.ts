// 敏感数据加密工具

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

// 生成加密密钥
async function getEncryptionKey(): Promise<CryptoKey> {
  // 使用固定的盐值派生密钥（实际应用应该使用用户密码派生）
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode('form_buddy_encryption_key_v1'),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const salt = encoder.encode('form_buddy_salt_v1');
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 加密敏感数据
 */
export async function encrypt(data: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      { name: ENCRYPTION_ALGORITHM, iv },
      key,
      dataBuffer
    );

    // 合并 IV 和加密数据
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // 转为 Base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * 解密敏感数据
 */
export async function decrypt(encryptedData: string): Promise<string> {
  try {
    const key = await getEncryptionKey();

    // 从 Base64 解码
    const combined = new Uint8Array(
      Array.from(atob(encryptedData), (c) => c.charCodeAt(0))
    );

    // 分离 IV 和加密数据
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: ENCRYPTION_ALGORITHM, iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * 检查数据是否已加密
 */
export function isEncrypted(data: string): boolean {
  try {
    const decoded = atob(data);
    // 加密数据至少包含 12 字节 IV + 16 字节认证标签
    return decoded.length >= 28;
  } catch {
    return false;
  }
}

/**
 * 安全地加密敏感字段
 */
export async function encryptSensitiveFields<T extends Record<string, unknown>>(
  obj: T,
  sensitiveKeys: string[]
): Promise<T> {
  const result = { ...obj };

  for (const key of sensitiveKeys) {
    const value = getObjectValue(result, key);
    if (typeof value === 'string' && value && !isEncrypted(value)) {
      const encrypted = await encrypt(value);
      setObjectValue(result, key, encrypted);
    }
  }

  return result;
}

/**
 * 解密敏感字段
 */
export async function decryptSensitiveFields<
  T extends Record<string, unknown>
>(obj: T, sensitiveKeys: string[]): Promise<T> {
  const result = { ...obj };

  for (const key of sensitiveKeys) {
    const value = getObjectValue(result, key);
    if (typeof value === 'string' && value && isEncrypted(value)) {
      try {
        const decrypted = await decrypt(value);
        setObjectValue(result, key, decrypted);
      } catch {
        // 解密失败，保留原值
      }
    }
  }

  return result;
}

// 辅助函数：获取嵌套对象值
function getObjectValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

// 辅助函数：设置嵌套对象值
function setObjectValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
}
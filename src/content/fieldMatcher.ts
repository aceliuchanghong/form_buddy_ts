// 字段匹配器

import { FormField, FieldMatch, FIELD_PATTERNS } from '../types/form';
import { ProfileData } from '../types/profile';

// 匹配规则
interface MatchingRule {
  patterns: RegExp[];
  profileKey: string;
  transformer?: (value: unknown) => string;
}

// 预定义匹配规则
const MATCHING_RULES: MatchingRule[] = [
  // 姓名
  {
    patterns: [/姓名|名字|真实姓名|^name$/i, /真实姓名/],
    profileKey: 'basic.name',
  },
  // 手机号
  {
    patterns: [/电话|手机|联系方式|联系电话|^phone$/i, /^mobile$/i, /手机号/],
    profileKey: 'contact.phone',
  },
  // 身份证
  {
    patterns: [/身份证|证件号|身份号码|idcard/i, /id_no/i, /证件代码/],
    profileKey: 'identity.idCardNumber',
  },
  // 邮箱
  {
    patterns: [/邮箱|email|mail/i, /电子邮箱/],
    profileKey: 'contact.email',
  },
  // 性别
  {
    patterns: [/性别|^gender$/i, /^sex$/i],
    profileKey: 'basic.gender',
    transformer: (value: unknown) => {
      const gender = value as string;
      if (gender === 'male') return '男';
      if (gender === 'female') return '女';
      return '其他';
    },
  },
  // 出生日期
  {
    patterns: [/出生|生日|birthday|出生日期/],
    profileKey: 'basic.birthday',
  },
  // 国籍
  {
    patterns: [/国籍|nationality/i],
    profileKey: 'basic.nationality',
  },
  // 民族
  {
    patterns: [/民族|ethnicity/i],
    profileKey: 'basic.ethnicity',
  },
  // 省份
  {
    patterns: [/省|省份|province/i],
    profileKey: 'address.province',
  },
  // 城市
  {
    patterns: [/市|城市|^city$/i],
    profileKey: 'address.city',
  },
  // 区/县
  {
    patterns: [/区|县|district/i],
    profileKey: 'address.district',
  },
  // 详细地址
  {
    patterns: [/地址|住址|联系地址|详细地址|^address$/i],
    profileKey: 'address.detail',
  },
  // 邮编
  {
    patterns: [/邮编|邮政编码|postal/i],
    profileKey: 'address.postalCode',
  },
  // 工作单位
  {
    patterns: [/工作单位|单位名称|company|employer/i],
    profileKey: 'work.company',
  },
  // 职位
  {
    patterns: [/职位|职务|position|job/i],
    profileKey: 'work.position',
  },
  // 学历
  {
    patterns: [/学历|education|degree/i],
    profileKey: 'education.degree',
  },
  // 学校
  {
    patterns: [/毕业院校|学校|school/i],
    profileKey: 'education.school',
  },
  // 专业
  {
    patterns: [/专业|major/i],
    profileKey: 'education.major',
  },
  // 微信
  {
    patterns: [/微信|wechat/i],
    profileKey: 'contact.wechat',
  },
];

/**
 * 规则匹配
 */
export function ruleBasedMatch(
  fields: FormField[],
  profile: ProfileData
): FieldMatch[] {
  const matches: FieldMatch[] = [];

  for (const field of fields) {
    const match = matchFieldByRules(field, profile);
    if (match) {
      matches.push(match);
    }
  }

  return matches;
}

/**
 * 通过规则匹配单个字段
 */
function matchFieldByRules(field: FormField, profile: ProfileData): FieldMatch | null {
  // 合并标签、name、placeholder 等信息进行匹配
  const searchTexts = [
    field.label,
    field.name,
    field.placeholder,
    ...field.context.nearbyText,
    field.context.sectionTitle || '',
    field.context.formName || '',
  ].filter(Boolean);

  const searchText = searchTexts.join(' ');

  for (const rule of MATCHING_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(searchText)) {
        const value = getProfileValue(profile, rule.profileKey);

        if (value !== undefined && value !== '') {
          return {
            fieldId: field.id,
            profileKey: rule.profileKey,
            value: rule.transformer ? rule.transformer(value) : String(value),
            confidence: calculateConfidence(field, rule.profileKey),
            source: 'rule',
          };
        }
      }
    }
  }

  return null;
}

/**
 * 获取档案中的值
 */
function getProfileValue(profile: ProfileData, keyPath: string): unknown {
  const keys = keyPath.split('.');
  let current: unknown = profile;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * 计算匹配置信度
 */
function calculateConfidence(field: FormField, profileKey: string): number {
  let confidence = 0.7; // 基础置信度

  // 如果标签匹配度高，增加置信度
  if (field.label && field.label.length > 0) {
    confidence += 0.1;
  }

  // 如果 name 属性明确，增加置信度
  if (field.name && field.name.length > 0) {
    confidence += 0.05;
  }

  // 如果是必填字段，增加置信度（通常必填字段更重要）
  if (field.required) {
    confidence += 0.05;
  }

  // 特定字段的置信度调整
  if (profileKey === 'identity.idCardNumber') {
    // 身份证号匹配置信度通常会低一些，因为需要精确匹配格式
    confidence -= 0.1;
  }

  return Math.min(1, Math.max(0, confidence));
}

/**
 * 填充表单字段
 */
export function fillField(field: FormField, value: string): boolean {
  const element = field.element;

  if (element instanceof HTMLInputElement) {
    return fillInput(element, value);
  } else if (element instanceof HTMLSelectElement) {
    return fillSelect(element, value);
  } else if (element instanceof HTMLTextAreaElement) {
    return fillTextArea(element, value);
  }

  return false;
}

/**
 * 填充 input 元素
 */
function fillInput(input: HTMLInputElement, value: string): boolean {
  // 处理不同类型的 input
  switch (input.type) {
    case 'radio':
    case 'checkbox':
      return toggleInput(input, value);
    case 'date':
      return fillDate(input, value);
    default:
      return fillText(input, value);
  }
}

/**
 * 填充文本输入
 */
function fillText(input: HTMLInputElement, value: string): boolean {
  try {
    // 清空现有值
    input.value = '';

    // 设置值
    input.value = value;

    // 触发事件（兼容 React/Vue 等框架）
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // 对于某些使用特殊事件监听的框架
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      data: value,
      inputType: 'insertText',
    });
    input.dispatchEvent(inputEvent);

    return true;
  } catch (error) {
    console.error('Failed to fill input:', error);
    return false;
  }
}

/**
 * 填充日期输入
 */
function fillDate(input: HTMLInputElement, value: string): boolean {
  try {
    // 尝试解析日期
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return false;
    }

    // 格式化为 YYYY-MM-DD
    const formatted = date.toISOString().split('T')[0];
    input.value = formatted;

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
  } catch {
    return false;
  }
}

/**
 * 切换 radio/checkbox
 */
function toggleInput(input: HTMLInputElement, value: string): boolean {
  try {
    const shouldCheck = value === 'true' || value === '1' || value === '是' || value === '男';
    input.checked = shouldCheck;

    input.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
  } catch {
    return false;
  }
}

/**
 * 填充 select 元素
 */
function fillSelect(select: HTMLSelectElement, value: string): boolean {
  try {
    // 尝试精确匹配 value
    const option = Array.from(select.options).find(
      (opt) => opt.value === value || opt.textContent?.trim() === value
    );

    if (option) {
      select.value = option.value;
    } else {
      // 模糊匹配
      const fuzzyOption = Array.from(select.options).find((opt) => {
        const text = opt.textContent?.trim().toLowerCase() || '';
        return text.includes(value.toLowerCase()) || value.toLowerCase().includes(text);
      });

      if (fuzzyOption) {
        select.value = fuzzyOption.value;
      } else {
        return false;
      }
    }

    select.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
  } catch {
    return false;
  }
}

/**
 * 填充 textarea 元素
 */
function fillTextArea(textarea: HTMLTextAreaElement, value: string): boolean {
  try {
    textarea.value = value;

    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
  } catch {
    return false;
  }
}

/**
 * 批量填充表单
 */
export function fillForm(
  fields: FormField[],
  matches: FieldMatch[]
): { success: number; failed: number } {
  let success = 0;
  let failed = 0;

  for (const match of matches) {
    const field = fields.find((f) => f.id === match.fieldId);
    if (field) {
      const result = fillField(field, match.value);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }
  }

  return { success, failed };
}
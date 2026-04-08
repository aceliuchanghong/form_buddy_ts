// 表单字段类型定义

export interface FormField {
  id: string;
  element: HTMLElement;
  type: FieldType;
  label: string;
  name: string;
  placeholder?: string;
  required: boolean;
  options?: SelectOption[];
  context: FieldContext;
}

export type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'tel'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'textarea'
  | 'file'
  | 'password';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldContext {
  labelText?: string;
  nearbyText: string[];
  sectionTitle?: string;
  formName?: string;
}

export interface FieldMatch {
  fieldId: string;
  profileKey: string;
  value: string;
  confidence: number;
  source: 'ai' | 'rule' | 'user';
}

export interface FormDetectionResult {
  forms: DetectedForm[];
  fields: FormField[];
}

export interface DetectedForm {
  id: string;
  element: HTMLFormElement | HTMLElement;
  name?: string;
  action?: string;
  fields: FormField[];
}

// 字段类型映射
export const INPUT_TYPE_MAP: Record<string, FieldType> = {
  text: 'text',
  password: 'password',
  email: 'email',
  tel: 'tel',
  number: 'number',
  date: 'date',
  file: 'file',
  checkbox: 'checkbox',
  radio: 'radio',
};

export const FIELD_PATTERNS: Record<string, RegExp[]> = {
  name: [/姓名|名字|真实姓名|^name$/i],
  phone: [/电话|手机|联系方式|联系电话|^phone$/i, /^mobile$/i],
  idCard: [/身份证|证件号|身份号码|idcard/i, /id_no/i],
  email: [/邮箱|email|mail/i],
  address: [/地址|住址|联系地址|详细地址|address/i],
  gender: [/性别|gender|sex/i],
  birthday: [/出生|生日|birthday|出生日期/i],
  province: [/省|省份|province/i],
  city: [/市|城市|city/i],
  district: [/区|县|district/i],
};
// 用户档案类型定义

export interface UserProfile {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
  data: ProfileData;
}

export interface ProfileData {
  // 基本信息
  basic: {
    name: string;
    gender: 'male' | 'female' | 'other';
    birthday: string;
    nationality: string;
    ethnicity?: string;
  };

  // 身份证件
  identity: {
    idCardNumber: string; // 加密存储
    idCardType: 'id_card' | 'passport' | 'hkm_pass' | 'tw_pass';
  };

  // 联系方式
  contact: {
    phone: string;
    email?: string;
    wechat?: string;
  };

  // 地址信息
  address: {
    province: string;
    city: string;
    district: string;
    street?: string;
    detail: string;
    postalCode?: string;
  };

  // 户籍信息
  household?: {
    type: 'urban' | 'rural';
    province: string;
    city: string;
    district: string;
    detail: string;
  };

  // 工作信息
  work?: {
    company: string;
    position: string;
    phone?: string;
  };

  // 学历信息
  education?: {
    degree: string;
    school: string;
    major?: string;
    graduateDate?: string;
  };

  // 紧急联系人
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };

  // 自定义字段
  customFields?: Record<string, string>;
}

// 创建默认档案
export function createDefaultProfile(): UserProfile {
  return {
    id: generateId(),
    name: '默认档案',
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    data: {
      basic: {
        name: '',
        gender: 'male',
        birthday: '',
        nationality: '中国',
      },
      identity: {
        idCardNumber: '',
        idCardType: 'id_card',
      },
      contact: {
        phone: '',
      },
      address: {
        province: '',
        city: '',
        district: '',
        detail: '',
      },
    },
  };
}

function generateId(): string {
  return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
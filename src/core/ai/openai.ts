// OpenAI API 服务

import { FormField, FieldMatch } from '../../types/form';
import { ProfileData } from '../../types/profile';

export class OpenAIService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string, baseUrl?: string, model?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || 'https://api.openai.com/v1';
    this.model = model || 'gpt-4o-mini';
  }

  /**
   * 测试 API 连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 分析表单字段并匹配数据
   */
  async analyzeAndMatch(
    fields: FormField[],
    profile: ProfileData
  ): Promise<FieldMatch[]> {
    const prompt = this.buildMatchPrompt(fields, profile);
    const response = await this.complete(prompt);

    return this.parseMatchResponse(response, fields);
  }

  /**
   * 构建匹配 Prompt
   */
  private buildMatchPrompt(fields: FormField[], profile: ProfileData): string {
    const fieldsInfo = fields.map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      name: f.name,
      placeholder: f.placeholder,
      required: f.required,
      options: f.options?.map((o) => o.label),
      context: {
        sectionTitle: f.context.sectionTitle,
        nearbyText: f.context.nearbyText.slice(0, 3), // 限制数量
      },
    }));

    return `你是一个表单字段分析专家。请分析以下表单字段，并将它们与用户数据进行匹配。

用户数据:
${JSON.stringify(profile, null, 2)}

表单字段:
${JSON.stringify(fieldsInfo, null, 2)}

请返回 JSON 格式的匹配结果，格式如下:
{
  "matches": [
    {
      "fieldId": "字段ID",
      "profileKey": "用户数据中的键路径，如 basic.name",
      "value": "要填充的值",
      "confidence": 0.95,
      "reasoning": "匹配理由"
    }
  ]
}

注意事项:
1. 只返回有较高把握的匹配，置信度(confidence)低于 0.6 的请忽略
2. 对于 select 类型字段，value 应该是选项的值（value），而不是显示文本
3. 对于身份证号等敏感字段，直接返回用户数据中的值
4. 如果某个字段无法匹配，不要包含在结果中
5. 必须返回有效的 JSON，不要有任何其他文字`;
  }

  /**
   * 调用 OpenAI API
   */
  private async complete(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: '你是一个表单字段分析专家，擅长识别表单字段的语义并匹配用户数据。请始终返回有效的 JSON 格式。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // 降低随机性，提高一致性
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * 解析 AI 响应
   */
  private parseMatchResponse(response: string, fields: FormField[]): FieldMatch[] {
    try {
      // 提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('No JSON found in AI response');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const matches: FieldMatch[] = [];

      for (const match of parsed.matches || []) {
        // 验证字段存在
        const field = fields.find((f) => f.id === match.fieldId);
        if (!field) continue;

        // 验证置信度
        if (match.confidence < 0.6) continue;

        matches.push({
          fieldId: match.fieldId,
          profileKey: match.profileKey,
          value: match.value,
          confidence: match.confidence,
          source: 'ai',
        });
      }

      return matches;
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return [];
    }
  }

  /**
   * 分析页面表单结构（用于 Agent 模式）
   */
  async analyzeFormStructure(
    pageContent: string,
    formType?: string
  ): Promise<{
    formType: string;
    steps: { description: string; action: string }[];
    requiredFields: string[];
  }> {
    const prompt = `分析以下页面内容，识别表单类型和填写步骤。

页面内容片段:
${pageContent.slice(0, 3000)}

${formType ? `已提示表单类型: ${formType}` : ''}

请返回 JSON:
{
  "formType": "表单类型，如：注册、登录、申请、报名等",
  "steps": [
    {"description": "步骤描述", "action": "fill|click|select|wait|submit"}
  ],
  "requiredFields": ["必填字段列表"]
}`;

    const response = await this.complete(prompt);

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found');
      }
      return JSON.parse(jsonMatch[0]);
    } catch {
      return {
        formType: 'unknown',
        steps: [],
        requiredFields: [],
      };
    }
  }

  /**
   * 获取下一步操作（用于 Agent 模式）
   */
  async getNextAction(
    currentState: {
      pageUrl: string;
      pageTitle: string;
      formFields: FormField[];
      previousActions: { action: string; result: string }[];
    },
    profile: ProfileData
  ): Promise<{
    action: 'fill' | 'click' | 'select' | 'wait' | 'submit' | 'done';
    target?: string;
    value?: string;
    reasoning: string;
  }> {
    const prompt = `你是一个自动化表单填写助手。根据当前状态，决定下一步操作。

当前状态:
- 页面URL: ${currentState.pageUrl}
- 页面标题: ${currentState.pageTitle}
- 表单字段: ${JSON.stringify(currentState.formFields.map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      name: f.name,
    })))}
- 已执行操作: ${JSON.stringify(currentState.previousActions)}

用户数据:
${JSON.stringify(profile)}

请返回 JSON:
{
  "action": "fill|click|select|wait|submit|done",
  "target": "目标元素的 CSS 选择器或描述",
  "value": "要填充的值（仅 fill 和 select 操作需要）",
  "reasoning": "为什么选择这个操作"
}

注意：
- 如果所有必填字段已填写完成，下一步应该是 submit
- 如果需要等待页面加载，使用 wait
- 如果表单已完成，返回 done
- 始终返回有效的 JSON`;

    const response = await this.complete(prompt);

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found');
      }
      return JSON.parse(jsonMatch[0]);
    } catch {
      return {
        action: 'done',
        reasoning: '无法解析操作',
      };
    }
  }
}
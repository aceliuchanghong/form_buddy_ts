// Agent 状态机 - 处理多步表单

import { AgentState, AgentAction, AgentActionType, AgentStatus } from '../../types/agent';
import { FormField, FieldMatch } from '../../types/form';
import { ProfileData } from '../../types/profile';
import { detectForms } from '../formDetector';
import { ruleBasedMatch, fillField } from '../fieldMatcher';
import { OpenAIService } from '../../core/ai/openai';
import { getSettings } from '../../core/storage/settingsStore';

export class AgentStateMachine {
  private state: AgentState;
  private profile: ProfileData;
  private aiService: OpenAIService | null = null;
  private fields: FormField[] = [];
  private onProgress?: (state: AgentState) => void;

  constructor(profile: ProfileData, onProgress?: (state: AgentState) => void) {
    this.profile = profile;
    this.onProgress = onProgress;
    this.state = {
      id: `agent_${Date.now()}`,
      status: 'idle',
      currentStep: 0,
      totalSteps: 0,
      actions: [],
      errors: [],
    };
  }

  /**
   * 初始化 Agent
   */
  async initialize(): Promise<boolean> {
    try {
      // 获取设置
      const settings = await getSettings();

      if (!settings.api.apiKey) {
        this.state.status = 'error';
        this.state.errors.push({
          step: 0,
          action: 'fill',
          message: '未配置 API Key',
          timestamp: Date.now(),
        });
        return false;
      }

      // 初始化 AI 服务
      this.aiService = new OpenAIService(
        settings.api.apiKey,
        settings.api.baseUrl,
        settings.api.model
      );

      // 检测表单字段
      this.fields = detectForms();

      if (this.fields.length === 0) {
        this.state.status = 'error';
        this.state.errors.push({
          step: 0,
          action: 'fill',
          message: '未检测到表单字段',
          timestamp: Date.now(),
        });
        return false;
      }

      // 分析表单结构（可选）
      if (settings.agent.autoNavigate) {
        await this.analyzeFormStructure();
      }

      this.state.status = 'running';
      return true;
    } catch (error: any) {
      this.state.status = 'error';
      this.state.errors.push({
        step: 0,
        action: 'fill',
        message: error.message || '初始化失败',
        timestamp: Date.now(),
      });
      return false;
    }
  }

  /**
   * 分析表单结构
   */
  private async analyzeFormStructure(): Promise<void> {
    if (!this.aiService) return;

    // 获取页面关键内容
    const pageContent = this.getPageContent();

    try {
      const analysis = await this.aiService.analyzeFormStructure(pageContent);

      // 根据分析结果生成操作序列
      this.state.actions = this.generateActions(analysis.steps);
      this.state.totalSteps = this.state.actions.length;
    } catch (error) {
      console.warn('Failed to analyze form structure, using default strategy');
    }
  }

  /**
   * 获取页面关键内容
   */
  private getPageContent(): string {
    const title = document.title;
    const forms = document.querySelectorAll('form');
    const headings = document.querySelectorAll('h1, h2, h3');
    const buttons = document.querySelectorAll('button, input[type="submit"]');

    let content = `Title: ${title}\n\n`;

    content += 'Headings:\n';
    headings.forEach((h) => {
      content += `- ${h.textContent?.trim()}\n`;
    });

    content += '\nForm Fields:\n';
    this.fields.forEach((f) => {
      content += `- ${f.label} (${f.type})\n`;
    });

    content += '\nButtons:\n';
    buttons.forEach((b) => {
      content += `- ${b.textContent?.trim() || b.getAttribute('value') || b.getAttribute('aria-label')}\n`;
    });

    return content;
  }

  /**
   * 生成操作序列
   */
  private generateActions(
    steps: { description: string; action: string }[]
  ): AgentAction[] {
    const actions: AgentAction[] = [];

    // 首先，填充所有字段
    const matches = ruleBasedMatch(this.fields, this.profile);

    for (const match of matches) {
      const field = this.fields.find((f) => f.id === match.fieldId);
      if (field) {
        actions.push({
          type: this.getFillActionType(field),
          target: this.getFieldSelector(field),
          value: match.value,
          maxRetries: 3,
        });
      }
    }

    // 添加分析出的步骤
    for (const step of steps) {
      if (step.action === 'click' || step.action === 'submit') {
        actions.push({
          type: 'click',
          target: this.findButtonSelector(step.description),
          maxRetries: 3,
        });
      } else if (step.action === 'wait') {
        actions.push({
          type: 'wait',
          condition: { type: 'time', duration: 1000 },
          maxRetries: 1,
        });
      }
    }

    return actions;
  }

  /**
   * 获取填充操作类型
   */
  private getFillActionType(field: FormField): AgentActionType {
    if (field.type === 'select') return 'select';
    if (field.type === 'checkbox' || field.type === 'radio') return 'click';
    return 'fill';
  }

  /**
   * 获取字段选择器
   */
  private getFieldSelector(field: FormField): string {
    const element = field.element;

    // 优先使用 ID
    if (element.id) {
      return `#${element.id}`;
    }

    // 使用 name 属性
    if (field.name) {
      return `[name="${field.name}"]`;
    }

    // 使用标签和类型
    if (field.type !== 'text') {
      return `${element.tagName.toLowerCase()}[type="${field.type}"]:nth-of-type(${this.getElementIndex(element)})`;
    }

    // 默认
    return `${element.tagName.toLowerCase()}:nth-of-type(${this.getElementIndex(element)})`;
  }

  /**
   * 获取元素索引
   */
  private getElementIndex(element: Element): number {
    const parent = element.parentElement;
    if (!parent) return 1;

    const siblings = Array.from(parent.children).filter(
      (el) => el.tagName === element.tagName
    );
    return siblings.indexOf(element) + 1;
  }

  /**
   * 查找按钮选择器
   */
  private findButtonSelector(description: string): string {
    // 首先查找提交按钮
    const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]');
    if (submitBtn) {
      if (submitBtn.id) return `#${submitBtn.id}`;
      return 'button[type="submit"], input[type="submit"]';
    }

    // 查找包含特定文本的按钮
    const buttons = document.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      const text = btn.textContent?.trim().toLowerCase() || '';
      if (text.includes(description.toLowerCase())) {
        if (btn.id) return `#${btn.id}`;
        return `button:contains("${btn.textContent?.trim()}")`;
      }
    }

    // 默认返回第一个按钮
    return 'button:first-of-type';
  }

  /**
   * 执行 Agent
   */
  async run(): Promise<AgentStatus> {
    const initialized = await this.initialize();
    if (!initialized) {
      return this.state.status;
    }

    const settings = await getSettings();
    const fillDelay = settings.agent.fillDelay || 200;

    while (this.state.status === 'running') {
      if (this.state.currentStep >= this.state.actions.length) {
        this.state.status = 'completed';
        break;
      }

      const action = this.state.actions[this.state.currentStep];

      try {
        await this.executeAction(action, fillDelay);
        this.state.currentStep++;

        // 通知进度
        this.onProgress?.(this.state);

        // 检查是否需要暂停（pause() 方法可能在执行期间被调用）
        if ((this.state.status as string) === 'paused') {
          break;
        }
      } catch (error: any) {
        this.handleError(action, error);

        // 如果错误太多，停止
        if (this.state.errors.length >= 5) {
          this.state.status = 'error';
          break;
        }
      }
    }

    return this.state.status;
  }

  /**
   * 执行单个操作
   */
  private async executeAction(
    action: AgentAction,
    delay: number
  ): Promise<void> {
    const maxRetries = action.maxRetries || 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        switch (action.type) {
          case 'fill':
            await this.fill(action.target!, action.value!);
            break;
          case 'click':
            await this.click(action.target!);
            break;
          case 'select':
            await this.selectOption(action.target!, action.value!);
            break;
          case 'wait':
            await this.wait(action.condition!);
            break;
          case 'submit':
            await this.submit(action.target);
            break;
        }

        // 操作成功，添加延迟
        await this.delay(delay);
        return;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        await this.delay(500 * (attempt + 1));
      }
    }
  }

  /**
   * 填充字段
   */
  private async fill(selector: string, value: string): Promise<void> {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const field = this.fields.find((f) => this.getFieldSelector(f) === selector);
    if (field) {
      const success = fillField(field, value);
      if (!success) {
        throw new Error(`Failed to fill field: ${selector}`);
      }
    }
  }

  /**
   * 点击元素
   */
  private async click(selector: string): Promise<void> {
    const element = document.querySelector(selector) as HTMLElement;
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    element.click();
  }

  /**
   * 选择选项
   */
  private async selectOption(selector: string, value: string): Promise<void> {
    const select = document.querySelector(selector) as HTMLSelectElement;
    if (!select) {
      throw new Error(`Select not found: ${selector}`);
    }

    const option = Array.from(select.options).find(
      (opt) => opt.value === value || opt.textContent?.trim() === value
    );

    if (option) {
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      throw new Error(`Option not found: ${value}`);
    }
  }

  /**
   * 等待
   */
  private async wait(condition: { type: string; duration?: number; selector?: string }): Promise<void> {
    if (condition.type === 'time' && condition.duration) {
      await this.delay(condition.duration);
    } else if (condition.type === 'element' && condition.selector) {
      const start = Date.now();
      const timeout = 5000;

      while (Date.now() - start < timeout) {
        if (document.querySelector(condition.selector)) {
          return;
        }
        await this.delay(100);
      }

      throw new Error(`Element not found within timeout: ${condition.selector}`);
    }
  }

  /**
   * 提交表单
   */
  private async submit(selector?: string): Promise<void> {
    if (selector) {
      await this.click(selector);
    } else {
      const form = this.fields[0]?.element.closest('form');
      if (form) {
        form.submit();
      } else {
        // 查找提交按钮
        const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
          (submitBtn as HTMLElement).click();
        }
      }
    }
  }

  /**
   * 错误处理
   */
  private handleError(action: AgentAction, error: Error): void {
    this.state.errors.push({
      step: this.state.currentStep,
      action: action.type,
      message: error.message,
      timestamp: Date.now(),
    });
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 暂停
   */
  pause(): void {
    if (this.state.status === 'running') {
      this.state.status = 'paused';
    }
  }

  /**
   * 恢复
   */
  resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'running';
    }
  }

  /**
   * 停止
   */
  stop(): void {
    this.state.status = 'error';
  }

  /**
   * 获取状态
   */
  getState(): AgentState {
    return { ...this.state };
  }
}
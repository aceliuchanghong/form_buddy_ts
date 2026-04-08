// 表单检测器

import { FormField, FieldType, FieldContext, INPUT_TYPE_MAP } from '../types/form';

/**
 * 检测页面中的所有表单字段
 */
export function detectForms(): FormField[] {
  const fields: FormField[] = [];

  // 获取所有 input, select, textarea 元素
  const inputs = document.querySelectorAll('input, select, textarea');

  inputs.forEach((element, index) => {
    const field = createFormField(element as HTMLElement, index);
    if (field) {
      fields.push(field);
    }
  });

  return fields;
}

/**
 * 创建表单字段对象
 */
function createFormField(element: HTMLElement, index: number): FormField | null {
  if (!(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLSelectElement) &&
      !(element instanceof HTMLTextAreaElement)) {
    return null;
  }

  // 跳过隐藏字段和 submit 按钮
  const inputElement = element as HTMLInputElement;
  if (inputElement.type === 'hidden' || inputElement.type === 'submit' || inputElement.type === 'button') {
    return null;
  }

  const fieldType = getFieldType(element);
  const label = extractLabel(element);
  const context = extractContext(element);

  const placeholder = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
    ? element.placeholder || ''
    : '';

  return {
    id: generateFieldId(element, index),
    element,
    type: fieldType,
    label: label || element.name || placeholder || `字段 ${index + 1}`,
    name: element.name || '',
    placeholder,
    required: element.required,
    options: element instanceof HTMLSelectElement
      ? extractSelectOptions(element)
      : undefined,
    context,
  };
}

/**
 * 获取字段类型
 */
function getFieldType(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): FieldType {
  if (element instanceof HTMLSelectElement) {
    return 'select';
  }
  if (element instanceof HTMLTextAreaElement) {
    return 'textarea';
  }

  // 处理 input 类型
  const inputType = element.type.toLowerCase();
  return INPUT_TYPE_MAP[inputType] || 'text';
}

/**
 * 提取字段标签
 */
function extractLabel(element: HTMLElement): string {
  // 策略 1: 通过 for 属性关联的 label
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) {
      return label.textContent?.trim() || '';
    }
  }

  // 策略 2: 父级 label 元素
  const parentLabel = element.closest('label');
  if (parentLabel) {
    const text = parentLabel.textContent?.trim() || '';
    // 移除输入元素的值，只保留标签文本
    const value = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
      ? element.value
      : '';
    return text.replace(value || '', '').trim();
  }

  // 策略 3: aria-label 属性
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return ariaLabel;
  }

  // 策略 4: aria-labelledby 属性
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) {
      return labelEl.textContent?.trim() || '';
    }
  }

  // 策略 5: 附近的文本节点（前一个兄弟元素或父元素的文本）
  const nearbyText = findNearbyLabelText(element);
  if (nearbyText) {
    return nearbyText;
  }

  // 策略 6: placeholder 作为备选
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.placeholder || '';
  }

  return '';
}

/**
 * 查找附近的标签文本
 */
function findNearbyLabelText(element: HTMLElement): string {
  // 查找前面的兄弟元素
  let prev = element.previousElementSibling;
  while (prev) {
    if (prev.tagName === 'LABEL') {
      return prev.textContent?.trim() || '';
    }
    if (prev.tagName === 'SPAN' || prev.tagName === 'DIV') {
      const text = prev.textContent?.trim() || '';
      if (text.length < 50) { // 避免获取到大段文本
        return text;
      }
    }
    prev = prev.previousElementSibling;
  }

  // 查找父元素的文本内容
  const parent = element.parentElement;
  if (parent) {
    // 检查是否在表格中
    const cell = element.closest('td, th');
    if (cell) {
      // 获取表头
      const row = cell.closest('tr');
      const table = cell.closest('table');
      if (table && row) {
        const rowElement = row as HTMLTableRowElement;
        const cellIndex = Array.from(rowElement.cells).indexOf(cell as HTMLTableCellElement);
        const headerRow = table.querySelector('thead tr, tr:first-child') as HTMLTableRowElement | null;
        if (headerRow && headerRow.cells && cellIndex >= 0 && cellIndex < headerRow.cells.length) {
          const header = headerRow.cells[cellIndex];
          if (header) {
            return header.textContent?.trim() || '';
          }
        }
      }
    }

    // 获取 section 或 form-group 的标题
    const container = element.closest('.form-group, .form-group, [class*="form"]');
    if (container) {
      const label = container.querySelector('.label, .form-label, label');
      if (label) {
        return label.textContent?.trim() || '';
      }
    }
  }

  return '';
}

/**
 * 提取字段上下文
 */
function extractContext(element: HTMLElement): FieldContext {
  return {
    labelText: extractLabel(element),
    nearbyText: extractNearbyText(element),
    sectionTitle: findSectionTitle(element),
    formName: findFormName(element),
  };
}

/**
 * 提取附近文本
 */
function extractNearbyText(element: HTMLElement): string[] {
  const texts: string[] = [];

  // 获取父元素中的所有文本节点
  const parent = element.parentElement;
  if (parent) {
    const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const text = node.textContent?.trim();
      if (text && text.length < 100) {
        texts.push(text);
      }
    }
  }

  return texts;
}

/**
 * 查找所在区块的标题
 */
function findSectionTitle(element: HTMLElement): string | undefined {
  // 向上查找 section 或 div 容器
  let container: Element | null = element.closest('section, fieldset, [role="group"]');
  if (!container && element.parentElement) {
    container = element.parentElement.closest('.section, .panel, .card');
  }

  if (container) {
    // 查找标题元素
    const heading = container.querySelector('h1, h2, h3, h4, h5, h6, legend, .title, .section-title');
    if (heading) {
      return heading.textContent?.trim();
    }
  }

  return undefined;
}

/**
 * 查找表单名称
 */
function findFormName(element: HTMLElement): string | undefined {
  const form = element.closest('form') as HTMLFormElement | null;
  if (form) {
    return form.name || form.id || form.getAttribute('aria-label') || undefined;
  }
  return undefined;
}

/**
 * 提取 select 选项
 */
function extractSelectOptions(select: HTMLSelectElement): { value: string; label: string }[] {
  return Array.from(select.options)
    .filter((opt) => opt.value)
    .map((opt) => ({
      value: opt.value,
      label: opt.textContent?.trim() || opt.value,
    }));
}

/**
 * 生成字段 ID
 */
function generateFieldId(element: HTMLElement, index: number): string {
  const name = (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)
    ? element.name
    : '';
  return element.id || `field_${index}_${element.tagName}_${name || 'unnamed'}`;
}

/**
 * 高亮显示字段（用于预览）
 */
export function highlightField(field: FormField, color: string = '#4CAF50'): void {
  const element = field.element as HTMLElement;
  element.style.outline = `2px solid ${color}`;
  element.style.outlineOffset = '2px';
}

/**
 * 清除高亮
 */
export function clearHighlight(field: FormField): void {
  const element = field.element as HTMLElement;
  element.style.outline = '';
  element.style.outlineOffset = '';
}

/**
 * 清除所有高亮
 */
export function clearAllHighlights(): void {
  const inputs = document.querySelectorAll('input, select, textarea');
  inputs.forEach((input) => {
    (input as HTMLElement).style.outline = '';
    (input as HTMLElement).style.outlineOffset = '';
  });
}
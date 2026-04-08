# Form Buddy - AI 政务表单填充助手

<div align="center">

🤖 **智能填写网页表单的 Chrome 扩展**

基于 AI 语义理解，自动识别网页表单字段含义，匹配用户信息进行智能填充。

</div>

## 功能特性

- ✅ **智能字段识别** - 自动检测页面表单字段，提取标签、名称、上下文等信息
- ✅ **规则匹配引擎** - 内置常用字段匹配规则（姓名、电话、身份证、地址等）
- ✅ **AI 语义分析** - 集成 OpenAI API，理解复杂字段语义
- ✅ **多用户档案** - 支持创建多个个人信息档案，一键切换
- ✅ **Agent 模式** - 支持多步骤复杂表单自动填写
- ✅ **本地加密存储** - 敏感信息（如身份证号）在浏览器本地加密存储

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/aceliuchanghong/form_buddy_ts.git
cd form_buddy_ts
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置 API Key

复制 `.env.example` 为 `.env` 并填入你的 OpenAI API Key：

```bash
cp .env.example .env
```

### 4. 构建扩展

```bash
npm run build
```

### 5. 安装到 Chrome

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目的 `dist` 目录

## 使用方法

### 配置用户档案

1. 点击扩展图标，进入设置页面
2. 在「用户档案」中添加个人信息（姓名、电话、地址等）
3. 敏感信息会自动加密存储

### 配置 API Key

1. 在设置页面找到「API 配置」
2. 选择 AI 服务商（OpenAI / Anthropic）
3. 输入 API Key
4. 可选：测试连接

### 自动填充

1. 打开需要填写表单的网页
2. 点击扩展图标
3. 选择用户档案
4. 点击「智能填充」

### Agent 模式

对于多步骤复杂表单：

1. 在弹窗中开启「Agent 模式」
2. 点击「智能填充」
3. 扩展会自动分析表单结构，按步骤填写

## 项目结构

```
form_buddy_ts/
├── src/
│   ├── background/       # Service Worker
│   ├── content/          # 内容脚本（注入页面）
│   │   ├── agent/       # Agent 状态机
│   │   ├── formDetector.ts
│   │   └── fieldMatcher.ts
│   ├── popup/           # 弹出窗口 UI
│   ├── options/         # 设置页面 UI
│   ├── core/            # 核心逻辑
│   │   ├── ai/          # OpenAI API 封装
│   │   ├── storage/     # 本地存储
│   │   └── crypto.ts    # 加密工具
│   ├── types/           # TypeScript 类型定义
│   └── manifest/        # manifest.json
├── public/              # 静态资源
└── dist/                # 构建输出
```

## 开发

```bash
# 开发模式（监视文件变化）
npm run dev

# 类型检查
npm run type-check

# 构建
npm run build
```

## 隐私与安全

- 所有用户数据存储在浏览器本地（`chrome.storage.local`）
- 敏感信息（如身份证号）使用 AES-GCM 加密
- API Key 加密存储，不上传服务器
- 仅在用户点击「智能填充」时发送数据到 AI 服务
- 不收集任何用户数据

## 注意事项

- 需要网络连接访问 AI API
- 首次使用请先配置 API Key 和个人信息
- 复杂表单建议使用 Agent 模式
- 填充结果仅供参考，请核对后再提交

## 技术栈

- TypeScript
- Chrome Extension Manifest V3
- OpenAI API
- Web Crypto API

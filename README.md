# rubick-translator · 翻译助手

轻量、即开即用的 Rubick UI 翻译插件。支持 Google(免费)、LibreTranslate、MyMemory，多语种互译，子输入框联动，历史记录与主题切换（跟随系统 / 浅色 / 深色）。

## 特性
- 支持引擎：Google(免费，无需 key)、LibreTranslate、MyMemory
- 自动检测源语言（可手动指定）
- 子输入框联动：Rubick 子输入实时同步
- 历史记录：最近 30 条，点击回填，一键复制
- 主题：跟随系统 / 浅色 / 深色
- 本地持久化：设置与历史均存储在 `rubick.db`

## 触发命令
- fy
- 翻译
- translate
- 译

在 Rubick 搜索框输入任一命令并回车进入插件。

## 引擎说明
- Google(免费)：默认启用；若网络受限或出现 429 限流，可切换其他引擎。
- LibreTranslate：默认地址 `https://libretranslate.com`，可在“设置”中自定义为自建/镜像。
- MyMemory：可选填写邮箱以提升配额。

## 本地安装
1. 克隆/下载本项目到本地（根目录包含 `package.json`）
2. 打开 Rubick → 插件市场 → 开发者 → 安装本地插件/本地调试
3. 选择本项目根目录完成安装
4. 在 Rubick 输入框输入 `翻译`（或 `fy`/`translate`/`译`）启动

> 无需构建：插件由 `index.html` + `preload.js` 直接运行。

## 使用
1. 在左侧输入文本，或在 Rubick 子输入框输入
2. 选择引擎、源语言、目标语言；可“交换”语言
3. 点击“翻译”或等待自动翻译（输入时自动触发，含防抖）
4. 右侧为翻译结果，可一键复制
5. 历史记录保留最近 30 条，点击回填

## 设置项
- 引擎：Google / LibreTranslate / MyMemory
- LibreTranslate 地址：自定义服务端点
- MyMemory 邮箱：用于提升配额（可选）
- 主题：跟随系统 / 浅色 / 深色（系统主题变化自动切换）

## 数据与隐私
- 本地存储文档 ID：`rubick-translator/settings`、`rubick-translator/history`
- 不采集任何个人隐私数据

## 目录结构
```
rubick-translator/
├─ package.json      # 插件元数据
├─ index.html        # UI 与交互
└─ preload.js        # 引擎调用、设置与历史、Rubick API 封装
```

## 常见问题
- Google 429：频率受限，稍后重试或切换引擎。
- LibreTranslate 慢/不可用：在“设置”里换为自建/镜像地址。
- 结果为空：检查网络/代理或服务限流情况。

## 定制与扩展
- 可在 `preload.js` 增加其它引擎（DeepL、火山、百度等）
- 需要秘钥的服务建议在设置面板统一管理
- UI 可直接修改 `index.html` 样式与布局

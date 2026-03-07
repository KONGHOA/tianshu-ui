# 天枢大数据治理平台 — 前端

> 基于 [Soybean Admin](https://github.com/soybeanjs/soybean-admin) 二次开发，配合天枢后端提供完整的大数据治理前端界面。

## 技术栈

| 类别 | 选型 |
|------|------|
| 核心框架 | Vue 3.5.x |
| 开发语言 | TypeScript 5.9.x |
| 构建工具 | Vite 7.3.x |
| UI 组件库 | Naive UI 2.43.2 |
| 状态管理 | Pinia 3.0.x |
| 路由 | Vue Router 4.6.x |
| HTTP 客户端 | Axios（`@sa/axios`） |
| CSS 引擎 | UnoCSS + Sass |
| 包管理器 | pnpm >= 10.5.0 |

## 环境要求

- Node.js >= 20.19.0
- pnpm >= 10.5.0

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式启动
pnpm dev

# 生产构建
pnpm build
```

## 常用命令

```bash
pnpm dev            # 开发环境
pnpm dev:test       # 测试环境
pnpm dev:prod       # 生产环境

pnpm build          # 生产构建
pnpm build:dev      # 开发构建
pnpm build:test     # 测试构建

pnpm typecheck      # TypeScript 类型检查
pnpm lint           # ESLint 检查并修复
pnpm gen-route      # 路由生成
pnpm preview        # 预览构建产物

pnpm commit         # 规范化提交
pnpm commit:zh      # 中文提交信息

pnpm cleanup        # 清理项目
pnpm update-pkg     # 依赖包更新
```

## 项目结构

```
tianshu-ui/
├── build/                      # 构建配置和 Vite 插件
│   ├── config/
│   └── plugins/
├── packages/                   # pnpm workspace 内部包
│   ├── axios/                  # HTTP 客户端（@sa/axios）
│   ├── color/                  # 颜色工具（@sa/color）
│   ├── hooks/                  # 可复用组合函数（@sa/hooks）
│   ├── materials/              # UI 材料组件（@sa/materials）
│   ├── scripts/                # 构建与开发脚本（@sa/scripts）
│   ├── uno-preset/             # UnoCSS 预设配置（@sa/uno-preset）
│   └── utils/                  # 通用工具函数（@sa/utils）
├── src/                        # 主应用源代码
│   ├── assets/                 # 静态资源
│   ├── components/             # 可复用 Vue 组件
│   ├── constants/              # 常量定义
│   ├── enum/                   # TypeScript 枚举
│   ├── hooks/                  # Vue 组合函数
│   ├── layouts/                # 页面布局
│   ├── locales/                # 国际化
│   ├── plugins/                # Vue 插件
│   ├── router/                 # 路由配置
│   ├── service/                # API 服务
│   ├── store/                  # Pinia 状态模块
│   ├── styles/                 # 全局样式
│   ├── theme/                  # 主题配置
│   ├── typings/                # TypeScript 类型定义
│   ├── utils/                  # 工具函数
│   └── views/                  # 页面组件
├── package.json
└── vite.config.ts
```

## 开发规范

### 命名约定

| 类型 | 规范 | 示例 |
|------|------|------|
| Vue 组件 | PascalCase | `UserProfile.vue` |
| TypeScript 文件 | camelCase | `userService.ts` |
| CSS/SCSS 文件 | kebab-case | `user-profile.scss` |
| Pinia Store | camelCase | `src/store/modules/auth.ts` |
| API 服务 | camelCase | `src/service/api/system.ts` |

### 组件开发

使用 Vue 3 Composition API + `<script setup lang="ts">`：

```typescript
// API 调用
import { useRequest } from '@/hooks/common/request';
const { data, loading } = useRequest(() => fetchUser(id));

// 表格管理
import { useTable } from '@/hooks/common/table';
const { tableData, loading, getPaginationData } = useTable(fetchList);

// 常用 hooks
import { useBoolean, useLoading } from '@sa/hooks';
const { bool: visible, setTrue: openModal } = useBoolean();
```

### 样式

优先使用 UnoCSS 工具类，仅在 UnoCSS 无法表达时编写自定义 CSS/SCSS：

```html
<div class="flex flex-col items-center justify-center p-4 m-2 rounded-md">
  <span class="text-lg font-bold">内容</span>
</div>
```

### 提交规范

项目通过 `simple-git-hooks` 强制执行：`pre-commit` 运行 `typecheck` + `lint`，`commit-msg` 校验约定式提交格式。

```
feat | fix | docs | style | refactor | perf | test | chore
```

使用 `pnpm commit`（或 `pnpm commit:zh`）进行规范化提交。

## 许可证

[MIT License](./LICENSE)

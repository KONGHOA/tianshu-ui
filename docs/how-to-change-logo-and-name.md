# 项目修改 Logo 和名称操作手册

修改本项目（基于 RuoYi Plus Soybean 架构）的系统 Logo 和应用名称，主要涉及静态资源替换、多语言配置（i18n）修改以及环境变量调整。请按照以下步骤依次操作。

## 1. 修改系统图标 (Logo & Favicon)

### 1.1 修改页面主 Logo
系统内部显示的的主题 Logo 是通过矢量图标（SVG）自动加载的。
* **文件路径**: `src/assets/svg-icon/logo.svg`
* **操作步骤**: 
  1. 准备您的系统 Logo（必须是 `.svg` 格式）。
  2. 直接覆盖替换掉上面的文件。
  3. *说明*: 替换后，由于使用了 `unplugin-icons` 插件，代码中的 `<icon-local-logo />` 组件会自动热更新并渲染您的新图标。

### 1.2 修改浏览器标签页图标 (Favicon)
浏览器页面标签上展示的小图标。
* **文件路径**: `public/favicon.svg`
* **操作步骤**:
  1. 将您的标签页小图标放到 `public/` 目录下。
  2. 如果您使用的是 `.ico` 或 `.png` 格式（如 `favicon.ico`），请务必同步修改入口 HTML 文件：
     * 打开 `index.html`
     * 找到第 5 行：`<link rel="icon" href="/favicon.svg" />`
     * 将 `href` 属性修改为您的新文件名，如 `<link rel="icon" href="/favicon.ico" />`

---

## 2. 修改系统名称 (App Title)

本项目的系统名称在两个不同的地方读取：**页面内部的多语言展示** 和 **网页的标签页标题 (Document Title)**。

### 2.1 修改页面内部显示的名称 (多语言配置)
由于系统启用了国际化 (i18n)，菜单栏顶部的标题读取的是多语言配置。您需要修改中文和英文对应的配置文件。

* **中文配置**: `src/locales/langs/zh-cn.ts`
  * **操作**: 打开文件，修改 `system` 对象下的 `title` 属性（约第 3 行）：
  ```typescript
  system: {
    title: '您的系统名称', // 将 'RuoYi Plus Soybean' 改为您想要的名称
    // ...
  }
  ```

* **英文配置**: `src/locales/langs/en-us.ts`
  * **操作**: 打开文件，修改同样的属性：
  ```typescript
  system: {
    title: 'Your System Name',
    // ...
  }
  ```

### 2.2 修改浏览器标签页标题 (网页 Title)
浏览器标签页上的文字由环境变量控制。
* **文件路径**: 根目录下的 `.env` 文件。
* **操作步骤**:
  1. 打开 `.env` 文件。
  2. 找到 `VITE_APP_TITLE` 变量并修改：
  ```env
  VITE_APP_TITLE=您的系统名称
  ```
  3. 如果您的环境配置文件中还有 `.env.dev`, `.env.prod`, `.env.test` 等文件，并且里面也定义了 `VITE_APP_TITLE`，**请同步将它们修改为您需要的值**。

---

## 3. 其他工程化信息修改 (可选)

为了使项目彻底变成您自己的工程，建议修改以下附加信息：

* **系统描述**: 在 `.env`（及各环境 `.env.*` 文件）中，修改 `VITE_APP_DESC` 字段为您系统的详细描述。
* **Package配置**: 打开根目录的 `package.json`，修改 `"name"`, `"version"`, `"description"`, `"author"` 等基础字段。

> **提示**: 修改完以上环境变量（`.env` 等配置）后，请重启前端开发服务器 (`npm run dev` 或 `pnpm dev`) 以使配置生效。
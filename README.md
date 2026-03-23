# LumiSportContest（竞技大空间竞猜系统）

React + Vite 前端，Node.js（Express + Socket.IO）后端。开发时可分别启动前后端，或使用仓库根目录 `start.bat`。

## 文档

**[→ 进入 `doc/` 文档目录与索引](./doc/README.md)**

需求、实施进展、操作指南、技术备忘等均在 `doc/` 下。

---

## 本地开发（脚手架说明）

基于 [Vite](https://vite.dev/) 的 React 模板，支持 HMR 与 ESLint。官方插件说明见 [plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) / [plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc)。

### React Compiler

默认未启用；若需启用见 [React Compiler 安装说明](https://react.dev/learn/react-compiler/installation)。

### ESLint 与 TypeScript

若在生产环境开发，建议配合 TypeScript 与 [`typescript-eslint`](https://typescript-eslint.io)；可参考 [Vite TS 模板](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts)。

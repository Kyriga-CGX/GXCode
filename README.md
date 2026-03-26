# 🏹 GXCode IDE

[![Version](https://img.shields.io/badge/version-1.2.0--stable-blue)](https://github.com/Kyriga-CGX/GXCode)
[![Electron](https://img.shields.io/badge/electron-30.0.0-informational)](https://www.electronjs.org/)
[![Status](https://img.shields.io/badge/status-production--ready-emerald)](https://github.com/Kyriga-CGX/GXCode)

**GXCode** is a professional-grade, lightweight IDE designed for modern AI-assisted development. Built on Electron and Monaco Editor, it combines the power of native system tools with a sleek, customizable interface.

---

## 🚀 Key Features

### 📂 Workspace & Navigation
- **Advanced Session Restore**: Reopens your last project and all files exactly where you left them.
- **Monaco Pro+: Breadcrumbs & Symbols**: Navigate complex files with real-time document symbols and breadcrumbs.
- **Global Search**: Find anything across your entire project with high-performance indexing and "Flash" highlight navigation.

### 🐞 Core Dev Tools
- **Playwright Test Explorer**: Integrated UI to scan, run, and monitor browser tests (Passed/Failed/Running).
- **Native Debugger**: One-click "Bug" icon to launch the Playwright Inspector (`PWDEBUG=1`) for stepped debugging.
- **Real-Time Diagnostics**: A dedicated "Problems" pane that tracks Monaco Editor markers (Errors, Warnings) system-wide.

### 🖥️ Professional Terminal
- **Multi-Shell Support**: Run PowerShell, CMD, or Git Bash seamlessly.
- **Tab Management**: Launch multiple terminal sessions in a tabbed interface.
- **Split View**: Side-by-side terminal support for complex multitasking.
- **Smart Paste**: Integrated right-click to paste from clipboard, optimized for rapid command execution.

### 🛠️ Git & Auto-Updater
- **Native Git Pane**: Stage, commit, pull, and push directly from the sidebar.
- **Git-Powered Auto-Updater**: GXCode monitors its own repository and notifies you when updates are available. Update with a single click from the Settings pane.

### 🧩 AI Ecosystem (Marketplace)
- **Agent Registry**: Install, configure, and manage specialized AI Agents (React Devs, SQL Architects, etc.).
- **Skill Marketplace**: Expand your agents' capabilities with dynamic "Skills" pulled from NPM or official GX registries.

---

## 🎨 Design Aesthetics
GXCode follows a **Premium Dark** aesthetic by default, featuring:
- **Glassmorphism**: Subtle backdrop blurs and transparent overlays.
- **Micro-animations**: Pulse effects for running tests and smooth transitions for sidebars.
- **Custom Themes**: Choose between Dark, Light, Apple Style, Aero, and even Anime-themed skins.

---

## 🛠️ Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Git](https://git-scm.com/)
- [Playwright](https://playwright.dev/) (per i test)

### Getting Started
1. **Clone the repository**:
   ```bash
   git clone https://github.com/Kyriga-CGX/GXCode.git
   cd GXCode
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Launch the IDE**:
   ```bash
   npm start
   ```

---

## 📦 Distribution
To build a standalone installer for Windows/Mac/Linux:
```bash
# Work in progress - implementation via electron-builder
npm run build
```

---

## 🤝 Contributing
GXCode is in continuous evolution. Feel free to open issues or submit pull requests to enhance the most professional AI-powered IDE!

---

**Developed with ❤️ by Kyriga & GXCode Team.**

# 🗺️ GXCode Site Map (Repository Map)

This document serves as a high-level reference for the GXCode IDE structure, key components, and core logic. Use this to quickly locate features and understand the relationship between files.

---

## 📂 Root Directory
- **[main.js](file:///./main.js)**: Electron main process. Handles window creation, IPC handlers for OS operations (file system, PTY, updates), and the backend Express API (:5000).
- **[preload.js](file:///./preload.js)**: Exposes secure APIs to the renderer process via `contextBridge`.
- **[package.json](file:///./package.json)**: Project dependencies and build scripts (`npm start`, `npm run build`).

---

## 🧠 Global State (`APP/core/state.js`)
Key state properties for logic tracking:
- `workspaceData`: Full tree of the current project.
- `openFiles`: Array of `{ name, path, content, loading }`.
- `activeFileId`: Path of the file in the left/main editor.
- `activeFileIdRight`: Path of the file in the split editor.
- `isSplitMode`: Boolean for dual-editor view.
- `gitStatus`: Map of `path -> status (M, A, D, U)`.
- `isTerminalMinimized`: UI flag for bottom panel.

---

## 🛠️ Key Functions & Logic

### Workspace Management (`APP/components/workspace.js`)
- `initWorkspace()`: Entry point. Initializes Monaco and drag-drop.
- `renderFileTree(files)`: Recursive HTML generator for the explorer.
- `window.switchTab(path)`: Global to switch active file.
- `window.closeTab(path)`: Global to close a tab and update state.
- `window.toggleSplitEditor()`: Logic for dual-pane view.
- `renderActiveFile()`: **HEART.** Syncs Monaco with `state.openFiles`.

### Bottom Panel & Terminal (`APP/components/bottomPanel.js` & `terminal.js`)
- `switchBottomTab(tabId)`: Handles tab switching and AI auto-expansion.
- `initTerminal()`: Sets up xterm.js and connects to backend PTY via WebSockets.

---

## 🖥️ UI Mapping (index.html)
Important element IDs and their purpose:
- `#hub-content-area`: Grid/Flex container for editors.
- `#monaco-editor-container`: Left editor DOM.
- `#monaco-editor-container-right`: Right editor DOM.
- `#workspace-tree-container`: File explorer root.
- `#bottom-panel`: Resizable utility area.
- `#terminal-container`: Xterm.js mount point.

---

## 🔌 IPC & Backend (`main.js` & `preload.js`)
- `open-project-folder`: Triggered by `#btn-open-folder`.
- `read-file`: Fetches content for Monaco.
- `fs-write-file`: Saves active editor content.
- `fs-delete`: Deletes from tree.
- `API :5000`: Mock backend for Marketplace, Agents, and Skills.

---

> [!IMPORTANT]
> Use this map to avoid "Exploring" files you already know. Always check `state.js` variables before proposing UI changes.

---

> [!NOTE]
> This map is a living document. Update it whenever new major components are added or architectural changes occur.

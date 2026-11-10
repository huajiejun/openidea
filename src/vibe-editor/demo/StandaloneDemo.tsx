import { useState, useCallback, useEffect } from "react";
import { VibeCodeEditor } from "../VibeCodeEditor";
import type { EditorFile } from "../types";
import { DEMO_FILES } from "./demo-files";
import styles from "./StandaloneDemo.module.css";

export function StandaloneDemo() {
  useEffect(() => {
    const previous = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = "dark";
    return () => {
      if (previous === undefined) delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = previous;
    };
  }, []);
  const [files, setFiles] = useState<EditorFile[]>(DEMO_FILES);
  const [activeId, setActiveId] = useState<string>(DEMO_FILES[0]!.id);
  const [showSidebar, setShowSidebar] = useState(true);
  const [logs, setLogs] = useState<string[]>([
    "🚀 VibeCodeEditor 组件初始化完成",
    "📂 加载示例工作区文件: TypeScript, Rust, JSON, Markdown",
  ]);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 19)]);
  }, []);

  const handleFileChange = useCallback((fileId: string, newContent: string) => {
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, content: newContent } : f)));
  }, []);

  const handleSave = useCallback(
    async (fileId: string, content: string) => {
      const file = files.find((f) => f.id === fileId);
      addLog(`💾 保存文件成功: ${file?.name || fileId} (${content.length} 字节)`);
      // Simulate network save latency
      await new Promise((r) => setTimeout(r, 200));
    },
    [files, addLog],
  );

  const handleCloseFile = useCallback(
    (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (files.length <= 1) {
        addLog(`⚠️ 至少保留一个文件`);
        return;
      }
      addLog(`✖ 关闭标签: ${file?.name}`);
      const remaining = files.filter((f) => f.id !== fileId);
      setFiles(remaining);
      if (activeId === fileId) {
        setActiveId(remaining[0]!.id);
      }
    },
    [files, activeId, addLog],
  );

  const handleAddFile = useCallback(() => {
    const idx = files.length + 1;
    const newFile: EditorFile = {
      id: `new-file-${Date.now()}`,
      name: `component${idx}.tsx`,
      path: `src/components/component${idx}.tsx`,
      language: "typescriptreact",
      content: `import React from "react";

export function Component${idx}() {
  return (
    <div className="card">
      <h3>新动态组件 ${idx}</h3>
      <p>在 Vibe-Kanban 中直接编辑与开发！</p>
    </div>
  );
}
`,
    };
    setFiles((prev) => [...prev, newFile]);
    setActiveId(newFile.id);
    addLog(`➕ 新增文件: ${newFile.name}`);
  }, [files.length, addLog]);

  return (
    <div
      className={styles.demo}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100vh",
        backgroundColor: "#141416",
        color: "#dfe1e5",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "16px 24px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Top Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
          paddingBottom: "12px",
          borderBottom: "1px solid #2b2d30",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #3871e1, #1e3a8a)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: "16px",
              color: "#fff",
            }}
          >
            VK
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              VibeCodeEditor 移植组件演示 (OpenIDEA CodeMirror 6)
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  backgroundColor: "#2e436e",
                  color: "#93c5fd",
                  padding: "2px 8px",
                  borderRadius: "12px",
                }}
              >
                React 19 + CM6
              </span>
            </h1>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#8c8f95" }}>
              抽离自 OpenIDEA 核心编辑器，支持多文件、多标签、语法高亮与快捷键保存，可无缝接入 Vibe-Kanban
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => setShowSidebar((v) => !v)}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              background: "#2b2d30",
              color: "#dfe1e5",
              border: "1px solid #3c3f41",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {showSidebar ? "隐藏侧栏" : "显示侧栏"}
          </button>
          <button
            onClick={handleAddFile}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              background: "#2e5cb8",
              color: "#ffffff",
              border: "1px solid #3871e1",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            + 新建文件
          </button>
        </div>
      </header>

      {/* Main Component Area */}
      <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <VibeCodeEditor
          files={files}
          activeFileId={activeId}
          onActiveFileChange={setActiveId}
          onFileChange={handleFileChange}
          onSave={handleSave}
          onCloseFile={handleCloseFile}
          showSidebar={showSidebar}
          height="100%"
        />
      </main>

      {/* Bottom Mini Console / Event Logger */}
      <footer
        style={{
          marginTop: "12px",
          height: "64px",
          backgroundColor: "#18191b",
          border: "1px solid #2b2d30",
          borderRadius: "4px",
          padding: "6px 12px",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: "10px",
            color: "#8c8f95",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "4px",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>组件交互事件日志</span>
          <span>按 Cmd+S (Ctrl+S) 触发保存回调</span>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            fontFamily: "'JetBrains Mono', Consolas, monospace",
            fontSize: "11px",
            color: "#6aab73",
          }}
        >
          {logs[0] && <div>{logs[0]}</div>}
          {logs[1] && <div style={{ color: "#8c8f95", opacity: 0.8 }}>{logs[1]}</div>}
        </div>
      </footer>
    </div>
  );
}

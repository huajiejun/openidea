import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, foldGutter, foldKeymap, indentOnInput } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";

import type { VibeCodeEditorProps } from "./types";
import { vibeDarkTheme, vibeDarkSyntax } from "./theme";
import { detectLanguageFromPath, getLanguageExtension } from "./languages";
import styles from "./VibeCodeEditor.module.css";

function getFileIcon(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "ts":
    case "tsx":
      return "🔷";
    case "js":
    case "jsx":
      return "🟨";
    case "rs":
      return "🦀";
    case "json":
      return "🟡";
    case "html":
      return "🌐";
    case "css":
    case "scss":
      return "🎨";
    case "md":
      return "📝";
    case "py":
      return "🐍";
    default:
      return "📄";
  }
}

export function VibeCodeEditor({
  files,
  activeFileId: controlledActiveId,
  onActiveFileChange,
  onFileChange,
  onSave,
  onCloseFile,
  showSidebar = true,
  showStatusBar = true,
  className,
  height = "520px",
}: VibeCodeEditorProps) {
  const [internalActiveId, setInternalActiveId] = useState<string>(files[0]?.id || "");
  const activeId = controlledActiveId ?? internalActiveId;

  // Track modified files
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  // Track save status message
  const [_saveStatus, setSaveStatus] = useState<"saved" | "modified" | "saving">("saved");
  // Cursor stats
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1, selected: 0 });

  const activeFile = useMemo(() => files.find((f) => f.id === activeId) || files[0], [files, activeId]);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  // Keep content map for uncommitted changes between tab switches
  const contentsRef = useRef<Map<string, string>>(new Map());

  // Initialize content cache
  useEffect(() => {
    files.forEach((f) => {
      if (!contentsRef.current.has(f.id)) {
        contentsRef.current.set(f.id, f.content);
      }
    });
  }, [files]);

  const handleSelectFile = useCallback(
    (fileId: string) => {
      if (onActiveFileChange) {
        onActiveFileChange(fileId);
      } else {
        setInternalActiveId(fileId);
      }
    },
    [onActiveFileChange],
  );

  const handleSave = useCallback(async () => {
    if (!activeFile) return;
    const content = contentsRef.current.get(activeFile.id) ?? activeFile.content;
    setSaveStatus("saving");
    try {
      if (onSave) {
        await onSave(activeFile.id, content);
      }
      setDirtyFiles((prev) => {
        const next = new Set(prev);
        next.delete(activeFile.id);
        return next;
      });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("modified");
    }
  }, [activeFile, onSave]);

  // Mount and rebuild editor when active file changes
  useEffect(() => {
    if (!editorContainerRef.current || !activeFile) return;

    if (editorViewRef.current) {
      editorViewRef.current.destroy();
      editorViewRef.current = null;
    }

    let disposed = false;
    const currentContent = contentsRef.current.get(activeFile.id) ?? activeFile.content;
    const detectedLang = activeFile.language || detectLanguageFromPath(activeFile.name);

    async function setupEditor() {
      const langExt = await getLanguageExtension(detectedLang, activeFile!.name);
      if (disposed || !editorContainerRef.current) return;

      const saveKeymap = keymap.of([
        {
          key: "Mod-s",
          run: () => {
            void handleSave();
            return true;
          },
        },
      ]);

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newDoc = update.state.doc.toString();
          contentsRef.current.set(activeFile!.id, newDoc);
          setDirtyFiles((prev) => new Set(prev).add(activeFile!.id));
          setSaveStatus("modified");
          if (onFileChange) {
            onFileChange(activeFile!.id, newDoc);
          }
        }
        if (update.selectionSet || update.docChanged) {
          const main = update.state.selection.main;
          const line = update.state.doc.lineAt(main.head);
          setCursorPos({
            line: line.number,
            col: main.head - line.from + 1,
            selected: Math.abs(main.to - main.from),
          });
        }
      });

      const baseExtensions: Extension[] = [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        vibeDarkTheme,
        vibeDarkSyntax,
        langExt,
        saveKeymap,
        updateListener,
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
      ];

      if (activeFile!.readOnly) {
        baseExtensions.push(EditorState.readOnly.of(true));
      }

      const state = EditorState.create({
        doc: currentContent,
        extensions: baseExtensions,
      });

      const view = new EditorView({
        state,
        parent: editorContainerRef.current,
      });

      editorViewRef.current = view;

      // Update cursor position initially
      const sel = state.selection.main;
      const initialLine = state.doc.lineAt(sel.head);
      setCursorPos({
        line: initialLine.number,
        col: sel.head - initialLine.from + 1,
        selected: 0,
      });
      setSaveStatus(dirtyFiles.has(activeFile!.id) ? "modified" : "saved");
    }

    void setupEditor();

    return () => {
      disposed = true;
      if (editorViewRef.current) {
        editorViewRef.current.destroy();
        editorViewRef.current = null;
      }
    };
  }, [activeFile?.id]);

  const activeLangName = useMemo(() => {
    if (!activeFile) return "Plain Text";
    return activeFile.language || detectLanguageFromPath(activeFile.name);
  }, [activeFile]);

  const isCurrentDirty = activeFile ? dirtyFiles.has(activeFile.id) : false;

  return (
    <div className={`${styles.container} ${className || ""}`} style={{ height }}>
      <div className={styles.body}>
        {/* Left Mini-Tree Sidebar */}
        {showSidebar && (
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <span>工作区文件</span>
              <span>{files.length}</span>
            </div>
            <ul className={styles.sidebarList}>
              {files.map((file) => {
                const isActive = file.id === activeId;
                const isDirty = dirtyFiles.has(file.id);
                return (
                  <li
                    key={file.id}
                    className={`${styles.fileItem} ${isActive ? styles.fileItemActive : ""}`}
                    onClick={() => handleSelectFile(file.id)}
                    title={file.path || file.name}
                  >
                    <span className={styles.fileIcon}>{getFileIcon(file.name)}</span>
                    <span className={styles.fileName}>{file.name}</span>
                    {isDirty && <span className={styles.fileDirtyDot} title="未保存变更" />}
                  </li>
                );
              })}
            </ul>
          </aside>
        )}

        {/* Main Editor Center */}
        <section className={styles.main}>
          {/* Top Tabs */}
          <div className={styles.tabBar}>
            {files.map((file) => {
              const isActive = file.id === activeId;
              const isDirty = dirtyFiles.has(file.id);
              return (
                <div
                  key={file.id}
                  className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
                  onClick={() => handleSelectFile(file.id)}
                >
                  <span className={styles.fileIcon}>{getFileIcon(file.name)}</span>
                  <span className={styles.tabTitle}>{file.name}</span>
                  {isDirty && <span className={styles.fileDirtyDot} />}
                  {onCloseFile && (
                    <button
                      className={styles.tabClose}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseFile(file.id);
                      }}
                      title="关闭标签"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}

            <div className={styles.tabActions}>
              <button
                className={`${styles.actionButton} ${isCurrentDirty ? styles.actionButtonPrimary : ""}`}
                onClick={() => void handleSave()}
                title="保存当前文件 (Cmd/Ctrl + S)"
              >
                💾 保存
              </button>
            </div>
          </div>

          {/* CodeMirror Host */}
          <div className={styles.editorWrapper}>
            <div ref={editorContainerRef} className={styles.editorHost} />
          </div>

          {/* Bottom Status Bar */}
          {showStatusBar && (
            <footer className={styles.statusBar}>
              <div className={styles.statusLeft}>
                <span className={styles.statusItem}>
                  Ln {cursorPos.line}, Col {cursorPos.col}
                  {cursorPos.selected > 0 && ` (${cursorPos.selected} 字符已选)`}
                </span>
                <span className={styles.statusItem}>UTF-8</span>
                <span className={styles.statusItem}>LF</span>
                <span className={styles.statusItem}>2 空格</span>
              </div>
              <div className={styles.statusRight}>
                <span className={styles.statusItem}>
                  <span className={styles.shortcutTip}>⌘S</span> 保存
                </span>
                <span className={styles.statusItem}>
                  <span className={styles.shortcutTip}>⌘F</span> 查找
                </span>
                <span className={styles.statusItem} style={{ textTransform: "capitalize" }}>
                  {activeLangName}
                </span>
                <span
                  className={`${styles.statusItem} ${isCurrentDirty ? styles.statusModified : styles.statusSuccess}`}
                >
                  {isCurrentDirty ? "● 未保存" : "✓ 已保存"}
                </span>
              </div>
            </footer>
          )}
        </section>
      </div>
    </div>
  );
}

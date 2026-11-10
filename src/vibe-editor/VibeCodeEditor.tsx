import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, foldGutter, foldKeymap, indentOnInput } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import type { VibeCodeEditorProps } from "./types";
import { vibeDarkTheme, vibeDarkSyntax } from "./theme";
import { detectLanguageFromPath, getLanguageExtension } from "./languages";
import { tx } from "@/platform/i18n";
import styles from "./VibeCodeEditor.module.css";

interface Document {
  state: EditorState;
  saved: string;
  incoming: string;
  conflict: boolean;
  saving: boolean;
  error: string;
  language: Compartment;
  access: Compartment;
  mode: string;
  scrollTop: number;
  scrollLeft: number;
}

export function VibeCodeEditor(props: VibeCodeEditorProps) {
  const { files, activeFileId, showSidebar = true, showStatusBar = true, className, height = "520px" } = props;
  const [selected, setSelected] = useState(files[0]?.id ?? "");
  const [ui, setUi] = useState(new Map<string, Document>());
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  const documents = useRef(new Map<string, Document>());
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const mounted = useRef<string | null>(null);
  const alive = useRef(false);
  const active = files.find((file) => file.id === (activeFileId ?? selected)) ?? files[0];
  const redraw = () => {
    if (alive.current) setUi(new Map([...documents.current].map(([id, doc]) => [id, { ...doc }])));
  };
  const dirty = (doc: Document) => doc.state.doc.toString() !== doc.saved;

  async function save(id: string) {
    const doc = documents.current.get(id);
    const file = latest.current.files.find((item) => item.id === id);
    if (!doc || !file || file.readOnly || doc.saving || doc.conflict || !latest.current.onSave) return;
    const text = doc.state.doc.toString();
    doc.saving = true;
    doc.error = "";
    redraw();
    try {
      await latest.current.onSave(id, text);
      doc.saved = text;
    } catch (error) {
      doc.error = error instanceof Error ? error.message : String(error);
    } finally {
      doc.saving = false;
      redraw();
    }
  }

  useEffect(() => {
    alive.current = true;
    const cache = documents.current;
    const editor = new EditorView({ parent: host.current! });
    view.current = editor;
    return () => {
      alive.current = false;
      const id = mounted.current;
      if (id && cache.has(id)) cache.get(id)!.state = editor.state;
      mounted.current = null;
      view.current = null;
      editor.destroy();
    };
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const ids = new Set(files.map((file) => file.id));
    for (const id of documents.current.keys()) if (!ids.has(id)) documents.current.delete(id);
    for (const file of files) {
      let doc = documents.current.get(file.id);
      const mode = file.language || detectLanguageFromPath(file.name);
      if (!doc) {
        const language = new Compartment();
        const access = new Compartment();
        doc = {
          saved: file.content,
          incoming: file.content,
          conflict: false,
          saving: false,
          error: "",
          language,
          access,
          mode: "",
          scrollTop: 0,
          scrollLeft: 0,
          state: EditorState.create({
            doc: file.content,
            extensions: [
              lineNumbers(),
              highlightActiveLineGutter(),
              drawSelection(),
              history(),
              foldGutter(),
              indentOnInput(),
              bracketMatching(),
              closeBrackets(),
              autocompletion(),
              highlightActiveLine(),
              highlightSelectionMatches(),
              vibeDarkTheme,
              vibeDarkSyntax,
              language.of([]),
              access.of(EditorState.readOnly.of(!!file.readOnly)),
              keymap.of([
                {
                  key: "Mod-s",
                  run: () => {
                    void save(file.id);
                    return true;
                  },
                },
                ...closeBracketsKeymap,
                ...defaultKeymap,
                ...searchKeymap,
                ...historyKeymap,
                ...foldKeymap,
                ...completionKeymap,
                indentWithTab,
              ]),
              EditorView.updateListener.of((update) => {
                const current = documents.current.get(file.id);
                if (!current || mounted.current !== file.id) return;
                current.state = update.state;
                if (update.docChanged) latest.current.onFileChange?.(file.id, update.state.doc.toString());
                if (update.docChanged || update.selectionSet) redraw();
              }),
            ],
          }),
        };
        documents.current.set(file.id, doc);
      }
      const current = doc.state.doc.toString();
      if (file.content !== doc.incoming) {
        if (file.content === current) {
          // Parent echo of an edit is not a disk save acknowledgment.
          doc.conflict = false;
        } else if (!dirty(doc)) {
          doc.state = doc.state.update({ changes: { from: 0, to: doc.state.doc.length, insert: file.content } }).state;
          doc.saved = file.content;
          doc.conflict = false;
        } else {
          doc.conflict = true;
        }
        doc.incoming = file.content;
      }
      const readOnly = !!file.readOnly || doc.conflict;
      if (doc.state.readOnly !== readOnly) {
        doc.state = doc.state.update({ effects: doc.access.reconfigure(EditorState.readOnly.of(readOnly)) }).state;
      }
      if (doc.mode !== mode) {
        doc.mode = mode;
        const pendingDoc = doc;
        void getLanguageExtension(mode, file.name)
          .then((extension) => {
            if (documents.current.get(file.id) !== pendingDoc || pendingDoc.mode !== mode) return;
            pendingDoc.state = pendingDoc.state.update({ effects: pendingDoc.language.reconfigure(extension) }).state;
            if (alive.current && mounted.current === file.id && view.current) view.current.setState(pendingDoc.state);
          })
          .catch((error: unknown) => {
            pendingDoc.error = String(error);
            redraw();
          });
      }
    }
    const previous = mounted.current ? documents.current.get(mounted.current) : undefined;
    if (previous)
      Object.assign(previous, { scrollTop: editor.scrollDOM.scrollTop, scrollLeft: editor.scrollDOM.scrollLeft });
    mounted.current = active?.id ?? null;
    const next = active && documents.current.get(active.id);
    if (!next || editor.state !== next.state) {
      editor.setState(next?.state ?? EditorState.create({ extensions: [EditorState.readOnly.of(true)] }));
    }
    if (next) {
      editor.scrollDOM.scrollTop = next.scrollTop;
      editor.scrollDOM.scrollLeft = next.scrollLeft;
    }
    redraw();
  }, [files, active]);

  function select(id: string) {
    if (latest.current.activeFileId === undefined) setSelected(id);
    latest.current.onActiveFileChange?.(id);
  }
  function close(id: string) {
    const doc = documents.current.get(id);
    if (doc?.saving) return;
    if (doc && dirty(doc) && !window.confirm(tx`Discard unsaved changes and close this file?`)) return;
    latest.current.onCloseFile?.(id);
  }
  const doc = active && ui.get(active.id);
  const selection = doc?.state.selection.main;
  const line = selection && doc?.state.doc.lineAt(selection.head);
  return (
    <div className={`${styles.container} ${className ?? ""}`} style={{ height }}>
      <div className={styles.body}>
        {showSidebar && (
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              工作区文件 <span>{files.length}</span>
            </div>
            <ul className={styles.sidebarList}>
              {files.map((file) => (
                <li key={file.id}>
                  <button
                    type="button"
                    className={`${styles.fileItem} ${active?.id === file.id ? styles.fileItemActive : ""}`}
                    onClick={() => select(file.id)}
                    title={file.path}
                  >
                    <span className={styles.fileName}>{file.name}</span>
                    {ui.get(file.id) && dirty(ui.get(file.id)!) && <span className={styles.fileDirtyDot} />}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
        <section className={styles.main}>
          <div className={styles.toolbar}>
            <div className={styles.tabBar}>
              {files.map((file) => (
                <div key={file.id} className={`${styles.tab} ${active?.id === file.id ? styles.tabActive : ""}`}>
                  <button type="button" className={styles.tabTitle} onClick={() => select(file.id)}>
                    {file.name}
                  </button>
                  {ui.get(file.id) && dirty(ui.get(file.id)!) && <span className={styles.fileDirtyDot} />}
                  {props.onCloseFile && (
                    <button
                      type="button"
                      className={styles.tabClose}
                      title="关闭标签"
                      aria-label={`${tx`Close`} ${file.name}`}
                      onClick={() => close(file.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className={styles.tabActions}>
              <button
                type="button"
                className={styles.actionButton}
                title="保存当前文件 (Cmd/Ctrl + S)"
                onClick={() => active && void save(active.id)}
                disabled={!doc || !!active?.readOnly || doc.saving || doc.conflict || !props.onSave}
              >
                保存
              </button>
            </div>
          </div>
          {(doc?.conflict || doc?.error) && (
            <div role="alert" className={styles.error}>
              {doc.conflict
                ? tx`External changes conflict with unsaved edits. Reopen the file before saving.`
                : doc.error}
            </div>
          )}
          <div className={styles.editorWrapper}>
            <div ref={host} className={styles.editorHost} />
          </div>
          {showStatusBar && (
            <footer className={styles.statusBar}>
              <span className={styles.statusLeft}>
                Ln {line?.number ?? 1}, Col {selection && line ? selection.head - line.from + 1 : 1}
              </span>
              <span className={styles.statusDetails}>
                UTF-8 · {active?.language || (active && detectLanguageFromPath(active.name))}
              </span>
              <span className={styles.statusRight}>
                {doc?.saving ? tx`Saving…` : doc && dirty(doc) ? "● 未保存" : "✓ 已保存"}
              </span>
            </footer>
          )}
        </section>
      </div>
    </div>
  );
}

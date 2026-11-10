import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { undo } from "@codemirror/commands";
import { describe, expect, it, vi } from "vitest";
import { VibeCodeEditor } from "./VibeCodeEditor";
import { getLanguageExtension } from "./languages";

const files = [
  { id: "a", name: "a.ts", path: "a.ts", content: "const a = 1;" },
  { id: "b", name: "b.ts", path: "b.ts", content: "const b = 2;" },
];
async function editor() {
  await waitFor(() => expect(document.querySelector(".cm-editor")).not.toBeNull());
  return EditorView.findFromDOM(document.querySelector(".cm-editor")!)!;
}
function append(view: EditorView, text = " ") {
  act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: text } }));
}

describe("VibeCodeEditor", () => {
  it("loads non-JavaScript languages", async () => {
    await expect(getLanguageExtension("json", "config.json")).resolves.toBeDefined();
  });
  it("keeps edits made during a pending save dirty", async () => {
    let finish!: () => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<VibeCodeEditor files={files} onSave={onSave} />);
    const view = await editor();
    append(view);
    fireEvent.click(screen.getByTitle("保存当前文件 (Cmd/Ctrl + S)"));
    append(view, "new");
    await act(async () => finish());
    expect(screen.getByText("● 未保存")).toBeInTheDocument();
  });
  it("restores undo history after switching files", async () => {
    const { rerender } = render(<VibeCodeEditor files={files} activeFileId="a" />);
    append(await editor(), "changed");
    rerender(<VibeCodeEditor files={files} activeFileId="b" />);
    rerender(<VibeCodeEditor files={files} activeFileId="a" />);
    const view = await editor();
    act(() => {
      undo(view);
    });
    expect(view.state.doc.toString()).toBe(files[0]!.content);
  });
  it("accepts clean external changes and read-only changes", async () => {
    const { rerender } = render(<VibeCodeEditor files={files} />);
    await editor();
    rerender(<VibeCodeEditor files={[{ ...files[0]!, content: "external", readOnly: true }]} />);
    await waitFor(() =>
      expect(EditorView.findFromDOM(document.querySelector(".cm-editor")!)!.state.doc.toString()).toBe("external"),
    );
    expect((await editor()).state.readOnly).toBe(true);
  });
  it("blocks saving conflicting external changes", async () => {
    const onSave = vi.fn();
    const { rerender } = render(<VibeCodeEditor files={files} onSave={onSave} />);
    append(await editor(), "local");
    rerender(<VibeCodeEditor files={[{ ...files[0]!, content: "external" }]} onSave={onSave} />);
    fireEvent.click(screen.getByTitle("保存当前文件 (Cmd/Ctrl + S)"));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
  it("uses the latest save callback for keyboard saves", async () => {
    const oldSave = vi.fn();
    const newSave = vi.fn();
    const { rerender } = render(<VibeCodeEditor files={files} onSave={oldSave} />);
    const view = await editor();
    rerender(<VibeCodeEditor files={files} onSave={newSave} />);
    append(view);
    fireEvent.keyDown(view.contentDOM, { key: "s", code: "KeyS", ctrlKey: true });
    await waitFor(() => expect(newSave).toHaveBeenCalled());
    expect(oldSave).not.toHaveBeenCalled();
  });
  it("allows cancelling closing a dirty file", async () => {
    const onCloseFile = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    render(<VibeCodeEditor files={files} onCloseFile={onCloseFile} />);
    append(await editor());
    fireEvent.click(screen.getAllByTitle("关闭标签")[0]!);
    expect(onCloseFile).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it("shows failed saves and retains dirty state", async () => {
    render(
      <VibeCodeEditor
        files={files}
        onSave={async () => {
          throw new Error("disk full");
        }}
      />,
    );
    append(await editor());
    fireEvent.click(screen.getByTitle("保存当前文件 (Cmd/Ctrl + S)"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("disk full"));
    expect(screen.getByText("● 未保存")).toBeInTheDocument();
  });
});

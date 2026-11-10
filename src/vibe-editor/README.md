# VibeCodeEditor prototype

`files` supplies open documents; `id` must be stable and unique. `onFileChange` reports local edits (echoing those edits through `files` does not acknowledge a disk save). `onSave` must resolve only after persistence succeeds and reject on failure. Without `onSave`, saving is disabled.

Each open document keeps its own CodeMirror state, including undo history and selection. Removing a file releases its state. Closing a dirty file asks before discarding; files cannot be closed while a save is pending. Host-driven removal bypasses that dialog: the host must guard workspace changes and unmounts.

Clean documents accept external content updates. External content that differs from unsaved local edits freezes the document and blocks saves. Preserve/copy the local edits, close the file, then reopen it with fresh contents to resolve the conflict. The backend must still enforce a revision/hash precondition on writes; client checks alone cannot prevent disk races.

This prototype has syntax highlighting, not LSP definition navigation or full OpenIDEA parity. Saves in the demo are simulated and disappear on refresh. It is not an All-in-One desktop build.

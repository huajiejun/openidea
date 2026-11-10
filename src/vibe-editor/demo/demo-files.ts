import type { EditorFile } from "../types";

export const DEMO_FILES: EditorFile[] = [
  {
    id: "file-ts",
    name: "workspaceManager.ts",
    path: "src/services/workspaceManager.ts",
    language: "typescript",
    content: `import { EventEmitter } from "node:events";

export interface WorkspaceConfig {
  id: string;
  name: string;
  rootPath: string;
  autoSaveInterval?: number;
}

export class WorkspaceManager extends EventEmitter {
  private activeWorkspaces = new Map<string, WorkspaceConfig>();

  constructor(private readonly baseDir: string) {
    super();
  }

  /**
   * Initializes a new workspace instance and registers file watchers.
   */
  public async initializeWorkspace(config: WorkspaceConfig): Promise<boolean> {
    if (this.activeWorkspaces.has(config.id)) {
      console.warn(\`Workspace \${config.id} already active\`);
      return false;
    }

    this.activeWorkspaces.set(config.id, config);
    this.emit("workspace:ready", { id: config.id, path: config.rootPath });
    return true;
  }

  public getWorkspace(id: string): WorkspaceConfig | undefined {
    return this.activeWorkspaces.get(id);
  }
}
`,
  },
  {
    id: "file-rs",
    name: "routes.rs",
    path: "crates/server/src/routes.rs",
    language: "rust",
    content: `use axum::{
    routing::{get, post},
    extract::{Path, State},
    response::Json,
    Router,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileContentResponse {
    pub path: String,
    pub content: String,
    pub line_count: usize,
    pub is_read_only: bool,
}

pub async fn get_file_content(
    Path(file_path): Path<String>,
) -> Result<Json<FileContentResponse>, (axum::http::StatusCode, String)> {
    // Read workspace file from disk safely
    let content = tokio::fs::read_to_string(&file_path).await
        .map_err(|e| (axum::http::StatusCode::NOT_FOUND, e.to_string()))?;

    let line_count = content.lines().count();
    Ok(Json(FileContentResponse {
        path: file_path,
        content,
        line_count,
        is_read_only: false,
    }))
}

pub fn create_router() -> Router {
    Router::new()
        .route("/api/files/{*file_path}", get(get_file_content))
}
`,
  },
  {
    id: "file-json",
    name: "config.json",
    path: "config/vibe-config.json",
    language: "json",
    content: `{
  "editor": {
    "theme": "vibe-dark",
    "tabSize": 2,
    "insertSpaces": true,
    "lineNumbers": true,
    "folding": true,
    "autoSave": true,
    "autoSaveDelay": 1500
  },
  "workspaces": {
    "defaultBranch": "main",
    "gitTimeoutSeconds": 30,
    "maxOpenTabs": 20
  }
}
`,
  },
  {
    id: "file-md",
    name: "DEVELOPMENT.md",
    path: "docs/DEVELOPMENT.md",
    language: "markdown",
    content: `# Vibe-Kanban Code Editor Component

This component provides a high-performance in-browser code editor extracted from OpenIDEA.

## Key Features
- **CodeMirror 6 Engine**: Smooth editing, virtualized rendering.
- **IntelliJ Dark Theme**: Low-contrast dark grey surface, high readability.
- **Multi-Tab Workspace**: Easy switching across multiple workspace files.
- **Full Keyboard Shortcuts**:
  - \`Cmd + S\` / \`Ctrl + S\`: Save file.
  - \`Cmd + F\` / \`Ctrl + F\`: In-editor search and replace.
  - \`Tab\` / \`Shift + Tab\`: Indent / Outdent.
`,
  },
];

import { IpcError } from "./ipc";

export type ProjectTrustScope = "current" | "local";

let prompt: ((path: string, scope: ProjectTrustScope) => Promise<boolean>) | null = null;

export function provideProjectTrustPrompt(
  value: (path: string, scope: ProjectTrustScope) => Promise<boolean>,
): () => void {
  prompt = value;
  return () => {
    if (prompt === value) prompt = null;
  };
}

export async function confirmProjectTrust(path: string, scope: ProjectTrustScope = "current"): Promise<void> {
  // 在 VK 宿主或内嵌环境下，服务端已经校验工作区边界，永远直接信任，绝不弹窗挂起
  if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__) {
    return;
  }
  if (prompt && !(await prompt(path, scope))) {
    throw new IpcError({ kind: "cancelled", message: "Project opening cancelled" });
  }
}

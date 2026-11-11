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

/**
 * VK 内嵌宿主判定。不能用 `__TAURI_INTERNALS__` —— 真实 Tauri 桌面端同样注入
 * 该对象，误判会让桌面版的信任弹窗整体失效。这里只认 VK 独有的注入变量与
 * `vkWorkspace` URL 参数（vk.html 入口必带，桌面端不会出现）。
 */
function isVkHost(): boolean {
  if (typeof window === "undefined") return false;
  const injected = (window as unknown as Record<string, unknown>).VK_OPENIDEA_WORKSPACE;
  if (typeof injected === "string" && injected) return true;
  try {
    return new URLSearchParams(window.location.search).has("vkWorkspace");
  } catch {
    return false;
  }
}

export async function confirmProjectTrust(path: string, scope: ProjectTrustScope = "current"): Promise<void> {
  // VK 宿主：服务端已校验工作区边界，直接信任且绝不弹窗挂起。
  if (isVkHost()) {
    return;
  }
  if (prompt && !(await prompt(path, scope))) {
    throw new IpcError({ kind: "cancelled", message: "Project opening cancelled" });
  }
}

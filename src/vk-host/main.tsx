/**
 * VK host entry: install the browser bridge BEFORE upstream code runs, then
 * boot the unmodified workbench entry (`../main.tsx`).
 */
import { installVkHost, resolveWorkspaceId } from "./bridge";

let workspaceId: string;
try {
  workspaceId = resolveWorkspaceId();
} catch (error) {
  document.getElementById("root")!.textContent =
    "vk-host: missing workspace id — set VK_OPENIDEA_WORKSPACE or ?vkWorkspace=";
  throw error;
}

const host = installVkHost({ workspaceId });
host.onStateChange((open) => {
  const splash = document.getElementById("splash");
  if (splash && !open) splash.dataset.vkDisconnected = "true";
  if (splash && open) delete splash.dataset.vkDisconnected;
});

// 先启动上游主入口
await import("../main");

// 确保整体采用暗黑风格（深色主题令牌与背景）
const { useThemeOverride, applyThemeAttributes } = await import("@/workbench/theme");
useThemeOverride.setState({ theme: "dark" });
applyThemeAttributes("dark");

// 关键安全策略适配：VK 在服务端已严格校验工作区边界，内嵌宿主中全部视为直接信任，
// 彻底绕过桌面版 invokeLocal 与弹窗 promptForTrust 导致的永久挂起！
const { provideProjectTrustPrompt } = await import("@/platform/projectTrust");
provideProjectTrustPrompt(async () => true);

// 异步自动打开工作区工程：轮询等待网关连接建立，然后调用上游 project.ts 的 openProject
void (async () => {
  const projectPath = new URLSearchParams(window.location.search).get("vkProject");
  if (!projectPath) return;

  for (let i = 0; i < 50; i++) {
    if (host.isConnected()) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  try {
    const { invoke } = await import("@/platform/tauriCore");
    await invoke("project_trust_set", { path: projectPath, trusted: true, folder: true }).catch(() => {});
    const { openProject } = await import("@/platform/project");
    console.info("vk-host: opening project in workbench:", projectPath);
    const p = await openProject(projectPath);
    console.info("vk-host: project opened successfully:", p.name || p.root);
  } catch (error) {
    console.error("vk-host: openProject failed:", error);
  }
})();

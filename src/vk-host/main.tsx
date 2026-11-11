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
  // VK embeds the IDE with a known workspace directory; open it automatically
  // once the gateway is reachable instead of the native folder dialog.
  const projectPath = new URLSearchParams(window.location.search).get("vkProject");
  if (open && projectPath) {
    void import("@/platform/ipc")
      .then(async ({ commands, call }) => {
        // VK 已在服务端校验工作区边界；宿主内默认信任，避免阻塞在信任确认框。
        await call(commands.projectTrustSet(projectPath, true, true));
        await call(commands.openProject(projectPath));
      })
      .catch((error: unknown) => console.error("vk-host: open_project failed", error));
  }
});

await import("../main");

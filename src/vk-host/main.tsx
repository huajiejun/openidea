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

await import("../main");

// VK embeds the IDE with a known workspace directory; open it automatically
// instead of walking the user through the native folder dialog.
const query = new URLSearchParams(window.location.search);
const projectPath = query.get("vkProject");
if (projectPath) {
  const { commands, call } = await import("@/platform/ipc");
  void call(commands.openProject(projectPath)).catch((error: unknown) => {
    console.error("vk-host: open_project failed", error);
  });
}

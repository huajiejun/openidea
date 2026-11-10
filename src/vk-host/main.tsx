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

const [{ hideSplash }] = await Promise.all([import("../platform/splash"), import("../main")]);
// The upstream entry renders asynchronously; hide the splash once React mounts
// (main.tsx does this for the desktop shell via hideSplash on mount).
setTimeout(() => hideSplash?.(), 0);

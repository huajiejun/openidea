/**
 * VK browser host for the full OpenIDEA workbench.
 *
 * Installs a minimal `window.__TAURI_INTERNALS__` so upstream code keeps using
 * `@tauri-apps/api` unchanged, while every command travels over one
 * authenticated WebSocket to the VK workspace gateway
 * (`/api/workspaces/{id}/openidea/ws`) and from there to the managed
 * OpenIDEA backend.
 *
 * Capability contract (no fake success):
 * - IDE domain commands: forwarded to the backend.
 * - `plugin:event|listen|unlisten`: implemented locally (backend `event`
 *   notifications fan out to registered callbacks).
 * - Streaming `Channel` args: encoded as `{$channel: id}` (same wire shape the
 *   desktop remote layer uses); backend `channel` notifications feed them.
 * - Native-shell plugin commands (`plugin:window|dialog|opener|...`) and
 *   unknown commands: rejected loudly — the capability matrix tracks gaps.
 */
import { Channel } from "@tauri-apps/api/core";

export interface VkHostOptions {
  workspaceId: string;
  /** Full ws:// or wss:// gateway URL; derived from location when omitted. */
  endpoint?: string;
  /** Label reported to upstream window helpers; one workbench per page. */
  windowLabel?: string;
}

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

const MAX_FRAME_BYTES = 8 * 1024 * 1024;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 5000;

export function defaultEndpoint(workspaceId: string): string {
  const fromQuery = new URLSearchParams(window.location.search).get("vkEndpoint");
  if (fromQuery) return fromQuery;
  // 默认跟随当前页面的协议与 host（生产同源反代、HTTPS 自动 wss）；
  // 仅本地分端口调试（1420/60773 前端 + 3001 后端）才直连 3001。
  const secure = window.location.protocol === "https:";
  const port = window.location.port;
  const splitPortDev = port === "1420" || port === "60773";
  const host = splitPortDev ? `${window.location.hostname || "127.0.0.1"}:3001` : window.location.host;
  return `${secure ? "wss" : "ws"}://${host}/api/workspaces/${workspaceId}/openidea/ws`;
}

export function resolveWorkspaceId(): string {
  const injected = (window as unknown as Record<string, unknown>).VK_OPENIDEA_WORKSPACE;
  if (typeof injected === "string" && injected) return injected;
  const fromQuery = new URLSearchParams(window.location.search).get("vkWorkspace");
  if (fromQuery) return fromQuery;
  throw new Error("vk-host: no workspace id (set VK_OPENIDEA_WORKSPACE or ?vkWorkspace=)");
}

export interface VkHostHandle {
  connect: () => void;
  isConnected: () => boolean;
  onStateChange: (handler: (open: boolean) => void) => void;
  workspaceId: string;
}

export function installVkHost(options: VkHostOptions): VkHostHandle {
  const endpoint = options.endpoint ?? defaultEndpoint(options.workspaceId);
  const pending = new Map<number, Pending>();
  const channels = new Map<number, Channel<unknown>>();
  const callbacks = new Map<number, (event: unknown) => void>();
  // 记录每个回调具体监听的事件名（如 "ide://event"），绝不串流给其他类型的监听器
  const eventMap = new Map<number, string>();
  const label = options.windowLabel ?? "vk-openidea";
  let nextId = 1;
  let socket: WebSocket | null = null;
  let reconnectDelay = RECONNECT_BASE_MS;
  const closedByUser = false;
  const onStateChange: Array<(open: boolean) => void> = [];

  function notifyState(open: boolean) {
    for (const handler of onStateChange) handler(open);
  }

  function connect() {
    if (closedByUser) return;
    const ws = new WebSocket(endpoint);
    socket = ws;
    ws.onopen = () => {
      reconnectDelay = RECONNECT_BASE_MS;
      notifyState(true);
    };
    ws.onmessage = (raw) => {
      if (typeof raw.data !== "string" || raw.data.length > MAX_FRAME_BYTES) return;
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(raw.data);
      } catch {
        return;
      }
      if (typeof message.method === "string") {
        if (message.method === "channel") {
          const params = message.params as { id: number; data: unknown };
          const channel = channels.get(params.id);
          if (!channel) return;
          const data = typeof params.data === "string" ? JSON.parse(params.data) : params.data;
          channel.onmessage(data);
        } else if (message.method === "event") {
          const params = message.params as { event: unknown };
          for (const [handlerId, eventName] of eventMap.entries()) {
            if (eventName === "ide://event" || eventName === "*") {
              try {
                callbacks.get(handlerId)?.({
                  event: "ide://event",
                  id: handlerId,
                  payload: params.event,
                });
              } catch (err) {
                console.warn("vk-host: ide event callback error:", err);
              }
            }
          }
        }
      } else if (typeof message.id !== "undefined") {
        const id = message.id as number;
        const awaiting = pending.get(id);
        if (!awaiting) return;
        pending.delete(id);
        if (message.error) {
          const error = message.error as { message?: string };
          awaiting.reject(new Error(error.message ?? "OpenIDEA backend error"));
        } else {
          awaiting.resolve(message.result);
        }
      }
    };
    ws.onclose = () => {
      socket = null;
      notifyState(false);
      for (const awaiting of pending.values()) awaiting.reject(new Error("vk-host: gateway disconnected"));
      pending.clear();
      const retry = reconnectDelay;
      reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
      setTimeout(connect, retry);
    };
    ws.onerror = () => ws.close();
  }

  function send(method: string, params: unknown): Promise<unknown> {
    const id = nextId++;
    const envelope = JSON.stringify({ id, method, params });
    // 如果还没连接上，等待连接建立（最多等 10 秒），避免启动期命令被立即打回
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return new Promise((resolve, reject) => {
        let retries = 0;
        const check = setInterval(() => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            clearInterval(check);
            pending.set(id, { resolve, reject });
            socket.send(envelope);
          } else if (++retries > 50) {
            clearInterval(check);
            reject(new Error("vk-host: gateway connection timeout (10s)"));
          }
        }, 200);
      });
    }
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket!.send(envelope);
    });
  }

  function encodeValue(value: unknown): unknown {
    if (value instanceof Channel) {
      const id = nextId++;
      channels.set(id, value as Channel<unknown>);
      return { $channel: id };
    }
    if (Array.isArray(value)) return value.map(encodeValue);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeValue(item)]));
    }
    return value;
  }

  const internals = {
    metadata: {
      currentWindow: { label },
      currentWebview: { label, windowLabel: label },
      currentWebviewWindow: { label },
    },
    transformCallback(callback: (event: unknown) => void, once = false): number {
      const id = nextId++;
      callbacks.set(id, (event) => {
        if (once) callbacks.delete(id);
        callback(event);
      });
      return id;
    },
    unregisterCallback(id: number): void {
      callbacks.delete(id);
    },
    unregisterListener(_event: string, id: number): void {
      eventMap.delete(id);
      callbacks.delete(id);
    },
    convertFileSrc(filePath: string): string {
      // No asset protocol over the gateway; callers surface a clear gap.
      throw new Error(`vk-host: convertFileSrc unsupported for ${filePath}`);
    },
    // Note: intentionally no `eval`/`plugins` surface.
    invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
      if (cmd === "plugin:event|listen") {
        const handler = args?.handler;
        if (typeof handler !== "number") {
          return Promise.reject(new Error("vk-host: event listen without handler"));
        }
        const eventName = typeof args?.event === "string" ? args.event : "ide://event";
        eventMap.set(handler, eventName);
        return Promise.resolve(handler);
      }
      if (cmd === "plugin:event|unlisten") {
        const handler = args?.handler;
        if (typeof handler === "number") eventMap.delete(handler);
        return Promise.resolve(null);
      }
      if (cmd === "plugin:path|resolve_directory") {
        return Promise.resolve("/tmp/openidea-user-data");
      }
      if (cmd.startsWith("plugin:window|is_")) {
        return Promise.resolve(false);
      }
      if (cmd.startsWith("plugin:")) {
        return Promise.reject(new Error(`vk-host: native capability not available in VK host: ${cmd}`));
      }
      return send(cmd, encodeValue(args ?? {}));
    },
  };

  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: false,
    value: internals,
  });

  // 装载时立即启动 WebSocket 连接
  connect();

  return {
    connect,
    isConnected() {
      return !!socket && socket.readyState === WebSocket.OPEN;
    },
    onStateChange(handler: (open: boolean) => void) {
      onStateChange.push(handler);
      handler(!!socket && socket.readyState === WebSocket.OPEN);
    },
    workspaceId: options.workspaceId,
  };
}

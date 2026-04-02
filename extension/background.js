import { config } from "./config.js";

const STORAGE_KEYS = {
  session: "knowlense_extension_session",
  connectRequest: "knowlense_connect_request",
  settings: "knowlense_settings"
};

let activeConnectPoll = null;

function apiUrl(settings) {
  return (settings?.apiUrl || config.apiUrl).replace(/\/$/, "");
}

function isFreshConnectRequest(request) {
  if (!request?.requestId) {
    return false;
  }

  const expiresAt = typeof request.expiresAt === "string" ? new Date(request.expiresAt).getTime() : NaN;
  if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) {
    return false;
  }

  const startedAt = typeof request.startedAt === "number" ? request.startedAt : 0;
  return startedAt > 0 && Date.now() - startedAt < 10 * 60 * 1000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadRuntimeState() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.session,
    STORAGE_KEYS.connectRequest,
    STORAGE_KEYS.settings
  ]);

  return {
    session: stored[STORAGE_KEYS.session] ?? null,
    connectRequest: stored[STORAGE_KEYS.connectRequest] ?? null,
    settings: stored[STORAGE_KEYS.settings] ?? { apiUrl: config.apiUrl }
  };
}

async function pollExtensionConnection() {
  if (activeConnectPoll) {
    return activeConnectPoll;
  }

  activeConnectPoll = (async () => {
    let state = await loadRuntimeState();
    if (!isFreshConnectRequest(state.connectRequest)) {
      if (state.connectRequest) {
        await chrome.storage.local.remove(STORAGE_KEYS.connectRequest);
      }
      return;
    }

    const timeoutAt = Date.now() + 10 * 60 * 1000;
    let delayMs = 2000;

    while (Date.now() < timeoutAt) {
      state = await loadRuntimeState();
      if (!isFreshConnectRequest(state.connectRequest)) {
        await chrome.storage.local.remove(STORAGE_KEYS.connectRequest);
        return;
      }

      try {
        const response = await fetch(`${apiUrl(state.settings)}/v1/extension/session/poll?requestId=${encodeURIComponent(state.connectRequest.requestId)}&t=${Date.now()}`, {
          cache: "no-store"
        });
        const payload = await response.json().catch(() => null);

        if (response.ok && payload?.status === "connected" && payload?.sessionToken) {
          await chrome.storage.local.set({
            [STORAGE_KEYS.session]: {
              sessionToken: payload.sessionToken,
              user: payload.user,
              billing: payload.billing ?? null,
              expiresAt: payload.expiresAt
            }
          });
          await chrome.storage.local.remove(STORAGE_KEYS.connectRequest);
          return;
        }

        if (response.ok && payload?.status === "expired") {
          await chrome.storage.local.remove(STORAGE_KEYS.connectRequest);
          return;
        }
      } catch {
        // Retry until the request window expires.
      }

      await sleep(delayMs);
      delayMs = Math.min(delayMs + 1000, 5000);
    }
  })().finally(() => {
    activeConnectPoll = null;
  });

  return activeConnectPoll;
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (changes[STORAGE_KEYS.connectRequest]?.newValue) {
    void pollExtensionConnection();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "knowlense.extensionConnect.wakeup") {
    void pollExtensionConnection()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to continue the extension connection." }));
    return true;
  }

  return undefined;
});

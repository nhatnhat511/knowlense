import { config } from "./config.js";

const storage = chrome.storage.local;
const EXTENSION_DEVICE_ID_KEY = "knowlense_extension_device_id";
const state = {
  session: null,
  connectRequest: null
};

const elements = {
  authBadge: document.getElementById("auth-badge"),
  accountView: document.getElementById("account-view"),
  connectView: document.getElementById("connect-view"),
  accountEmail: document.getElementById("account-email"),
  accountPlan: document.getElementById("account-plan"),
  disconnectSession: document.getElementById("disconnect-session"),
  openDashboardSite: document.getElementById("open-dashboard-site"),
  connectSession: document.getElementById("connect-session"),
  status: document.getElementById("status")
};

async function loadState() {
  const stored = await storage.get([
    "knowlense_extension_session",
    "knowlense_connect_request"
  ]);

  state.session = stored.knowlense_extension_session ?? null;
  state.connectRequest = stored.knowlense_connect_request ?? null;
}

function apiUrl() {
  return config.apiUrl.replace(/\/$/, "");
}

async function getExtensionDeviceId() {
  const stored = await storage.get([EXTENSION_DEVICE_ID_KEY]);
  const existingDeviceId = typeof stored[EXTENSION_DEVICE_ID_KEY] === "string" ? stored[EXTENSION_DEVICE_ID_KEY] : "";

  if (existingDeviceId) {
    return existingDeviceId;
  }

  const deviceId = crypto.randomUUID();
  await storage.set({ [EXTENSION_DEVICE_ID_KEY]: deviceId });
  return deviceId;
}

function setStatus(message, kind = "idle") {
  elements.status.textContent = message;
  elements.status.className = `status${kind === "idle" ? "" : ` ${kind}`}`;
}

function render() {
  const isConnected = Boolean(state.session?.sessionToken);
  elements.authBadge.textContent = isConnected ? "Connected" : "Disconnected";
  elements.accountView.classList.toggle("hidden", !isConnected);
  elements.connectView.classList.toggle("hidden", isConnected);
  elements.accountEmail.textContent = state.session?.user?.email || "Connected session";
  const planStatus = state.session?.billing?.status;
  const isPremium = planStatus === "active";
  elements.accountPlan.textContent = isPremium ? "Premium" : "Free";
  elements.accountPlan.className = `plan-badge${isPremium ? " premium" : ""}`;
}

async function persistSession(session) {
  state.session = session;
  await storage.set({ knowlense_extension_session: session });
  render();
}

async function persistConnectRequest(request) {
  state.connectRequest = request;
  await storage.set({ knowlense_connect_request: request });
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
  if (!startedAt) {
    return false;
  }

  return Date.now() - startedAt < 2 * 60 * 1000;
}

async function fetchApiProfile(token) {
  const response = await fetch(`${apiUrl()}/v1/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await response.json().catch(() => null);

  if (response.status === 401) {
    return {
      invalid: true,
      user: null,
      billing: null
    };
  }

  if (!response.ok || !payload?.user) {
    throw new Error(payload?.error || "Unable to validate the current session.");
  }

  return {
    invalid: false,
    user: payload.user,
    billing: payload.billing ?? null
  };
}

async function startConnectFlow() {
  const deviceId = await getExtensionDeviceId();
  const response = await fetch(`${apiUrl()}/v1/extension/session/start`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      deviceId
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.requestId) {
    throw new Error(payload?.error || "Unable to start the extension connection flow.");
  }

  const request = {
    requestId: payload.requestId,
    expiresAt: payload.expiresAt,
    startedAt: Date.now()
  };

  await persistConnectRequest(request);
  chrome.tabs.create({ url: `${config.connectUrl}?request=${encodeURIComponent(request.requestId)}` });
  setStatus("Waiting for account approval...", "success");
  chrome.runtime.sendMessage({ type: "knowlense.extensionConnect.wakeup" }).catch(() => null);
}

async function pollConnectFlow() {
  if (!isFreshConnectRequest(state.connectRequest)) {
    if (state.connectRequest) {
      await persistConnectRequest(null);
    }
    return;
  }

  const timeoutAt = Date.now() + 90 * 1000;
  let transientFailures = 0;

  while (Date.now() < timeoutAt) {
    let response;
    let payload;

    try {
      response = await fetch(`${apiUrl()}/v1/extension/session/poll?requestId=${encodeURIComponent(state.connectRequest.requestId)}&t=${Date.now()}`, {
        cache: "no-store"
      });
      payload = await response.json().catch(() => null);
    } catch {
      transientFailures += 1;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }

    if (!response.ok) {
      if (response.status === 404 || response.status === 429 || response.status >= 500) {
        transientFailures += 1;
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      throw new Error(payload?.error || "Unable to poll the connection request.");
    }

    transientFailures = 0;

    if (payload?.status === "connected" && payload?.sessionToken) {
      await persistSession({
        sessionToken: payload.sessionToken,
        user: payload.user,
        billing: payload.billing ?? null,
        expiresAt: payload.expiresAt
      });
      await persistConnectRequest(null);
      setStatus("Your account is now connected.", "success");
      return;
    }

    if (payload?.status === "expired") {
      await persistConnectRequest(null);
      setStatus("This connection request expired. Start a new one from the popup.", "error");
      return;
    }

    if (payload?.status === "authorized") {
      setStatus("Approval received. Finishing the connection...", "success");
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  setStatus(transientFailures > 0 ? "We are still finishing the connection. Keep the popup open and it will continue automatically." : "Still waiting for approval. You can keep this popup open or start again.", "idle");
}

async function revokeExtensionSession(sessionToken) {
  const response = await fetch(`${apiUrl()}/v1/extension/session/revoke`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`
    }
  });
  const payload = await response.json().catch(() => null);

  if (response.status === 401) {
    return { revoked: true, stale: true };
  }

  if (!response.ok) {
    throw new Error(payload?.error || "Unable to revoke this browser session from the server.");
  }

  return {
    revoked: Boolean(payload?.revoked),
    stale: false
  };
}

async function handleDisconnect() {
  if (!state.session?.sessionToken) {
    await persistSession(null);
    setStatus("This browser has been disconnected from your account.");
    return;
  }

  try {
    await revokeExtensionSession(state.session.sessionToken);
    await persistSession(null);
    setStatus("This browser has been disconnected from your account.", "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Unable to disconnect this browser right now.", "error");
  }
}

function attachEvents() {
  elements.openDashboardSite.addEventListener("click", () => {
    chrome.tabs.create({ url: config.dashboardUrl });
  });

  elements.connectSession.addEventListener("click", async () => {
    try {
      await startConnectFlow();
    } catch (error) {
      setStatus(error.message, "error");
    }
  });

  elements.disconnectSession.addEventListener("click", handleDisconnect);
}

function attachStorageSync() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(changes, "knowlense_extension_session")) {
      state.session = changes.knowlense_extension_session.newValue ?? null;
      render();

      if (state.session?.sessionToken) {
        void persistConnectRequest(null);
        setStatus("Your account is now connected.", "success");
        return;
      }
    }

    if (Object.prototype.hasOwnProperty.call(changes, "knowlense_connect_request")) {
      state.connectRequest = changes.knowlense_connect_request.newValue ?? null;

      if (state.session?.sessionToken) {
        return;
      }

      if (isFreshConnectRequest(state.connectRequest)) {
        setStatus("Waiting for account approval...", "success");
      } else {
        setStatus("Connect your account to get started.");
      }
    }
  });
}

async function boot() {
  await loadState();

  if (state.session?.sessionToken) {
    try {
      const user = await fetchApiProfile(state.session.sessionToken);
      if (user.invalid) {
        await persistSession(null);
        setStatus("Your website account changed or signed out. Reconnect this extension to continue.", "error");
        attachEvents();
        render();
        return;
      }
      state.session = { ...state.session, user: user.user, billing: user.billing };
      await storage.set({ knowlense_extension_session: state.session });
      setStatus("Your account is connected and ready to use.", "success");
    } catch {
      setStatus("We could not verify your connection right now. Try again shortly.", "error");
    }
  } else if (isFreshConnectRequest(state.connectRequest)) {
    setStatus("Waiting for account approval...", "success");
    chrome.runtime.sendMessage({ type: "knowlense.extensionConnect.wakeup" }).catch(() => null);
  } else {
    if (state.connectRequest) {
      await persistConnectRequest(null);
    }
    setStatus("Connect your account to get started.");
  }

  attachEvents();
  attachStorageSync();
  render();
}

void boot();

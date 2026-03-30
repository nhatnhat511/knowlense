import { config } from "./config.js";

const storage = chrome.storage.local;
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
  openSite: document.getElementById("open-site"),
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
  const isPremium = planStatus === "active" || planStatus === "trial";
  elements.accountPlan.textContent = isPremium ? "Premium" : "Free";
  elements.accountPlan.className = `plan-badge${isPremium ? " premium" : ""}`;
}

async function persistSession(session) {
  state.session = session;
  await storage.set({ knowlense_extension_session: session });
  if (session?.sessionToken) {
    chrome.runtime.sendMessage({ type: "knowlense.rankTracking.wakeup" }).catch(() => null);
  }
  render();
}

async function persistConnectRequest(request) {
  state.connectRequest = request;
  await storage.set({ knowlense_connect_request: request });
}

async function fetchApiProfile(token) {
  const response = await fetch(`${apiUrl()}/v1/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.user) {
    throw new Error(payload?.error || "Unable to validate the current session.");
  }

  return {
    user: payload.user,
    billing: payload.billing ?? null
  };
}

async function startConnectFlow() {
  const response = await fetch(`${apiUrl()}/v1/extension/session/start`, {
    method: "POST"
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.requestId) {
    throw new Error(payload?.error || "Unable to start the extension connection flow.");
  }

  const request = {
    requestId: payload.requestId,
    expiresAt: payload.expiresAt
  };

  await persistConnectRequest(request);
  chrome.tabs.create({ url: `${config.connectUrl}?request=${encodeURIComponent(request.requestId)}` });
  setStatus("Waiting for website approval...", "success");
  await pollConnectFlow();
}

async function pollConnectFlow() {
  if (!state.connectRequest?.requestId) {
    return;
  }

  const timeoutAt = Date.now() + 90 * 1000;

  while (Date.now() < timeoutAt) {
    const response = await fetch(`${apiUrl()}/v1/extension/session/poll?requestId=${encodeURIComponent(state.connectRequest.requestId)}`);
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error || "Unable to poll the connection request.");
    }

    if (payload?.status === "connected" && payload?.sessionToken) {
      await persistSession({
        sessionToken: payload.sessionToken,
        user: payload.user,
        billing: payload.billing ?? null,
        expiresAt: payload.expiresAt
      });
      await persistConnectRequest(null);
      setStatus("Extension connected through the website.", "success");
      return;
    }

    if (payload?.status === "expired") {
      await persistConnectRequest(null);
      setStatus("Connection request expired. Start again from the popup.", "error");
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  setStatus("Still waiting for approval. You can keep the popup open or start again.", "idle");
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
    setStatus("Extension session removed from this browser.");
    return;
  }

  try {
    await revokeExtensionSession(state.session.sessionToken);
    await persistSession(null);
    setStatus("Extension disconnected from this browser and revoked on the server.", "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Unable to disconnect this browser session.", "error");
  }
}

function attachEvents() {
  elements.openDashboardSite.addEventListener("click", () => {
    chrome.tabs.create({ url: config.dashboardUrl });
  });

  elements.openSite.addEventListener("click", () => {
    chrome.tabs.create({ url: config.websiteUrl });
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

async function boot() {
  await loadState();

  if (state.session?.sessionToken) {
    try {
      const user = await fetchApiProfile(state.session.sessionToken);
      state.session = { ...state.session, user: user.user, billing: user.billing };
      await storage.set({ knowlense_extension_session: state.session });
      setStatus("Extension session is active.", "success");
    } catch {
      setStatus("Stored extension session could not be verified right now.", "error");
    }
  } else if (state.connectRequest?.requestId) {
    setStatus("Waiting for website approval...", "success");
    setTimeout(() => {
      void pollConnectFlow().catch((error) => setStatus(error.message, "error"));
    }, 200);
  } else {
    setStatus("Connect this extension through the website to begin.");
  }

  attachEvents();
  render();
}

void boot();

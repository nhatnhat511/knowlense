import { config } from "./config.js";

const storage = chrome.storage.local;
const state = {
  session: null,
  settings: {
    apiUrl: config.apiUrl
  },
  lastKeywordRun: null,
  connectRequest: null
};

const elements = {
  settingsToggle: document.getElementById("settings-toggle"),
  settingsPanel: document.getElementById("settings-panel"),
  apiOrigin: document.getElementById("api-origin"),
  saveSettings: document.getElementById("save-settings"),
  openDashboard: document.getElementById("open-dashboard"),
  authBadge: document.getElementById("auth-badge"),
  accountView: document.getElementById("account-view"),
  connectView: document.getElementById("connect-view"),
  accountEmail: document.getElementById("account-email"),
  disconnectSession: document.getElementById("disconnect-session"),
  openSite: document.getElementById("open-site"),
  openDashboardSite: document.getElementById("open-dashboard-site"),
  connectSession: document.getElementById("connect-session"),
  status: document.getElementById("status"),
  analyzePage: document.getElementById("analyze-page"),
  refreshAnalysis: document.getElementById("refresh-analysis"),
  analysisEmpty: document.getElementById("analysis-empty"),
  analysisCard: document.getElementById("analysis-card"),
  analysisQuery: document.getElementById("analysis-query"),
  analysisCount: document.getElementById("analysis-count"),
  analysisTopOpportunity: document.getElementById("analysis-top-opportunity"),
  analysisKeywords: document.getElementById("analysis-keywords")
};

async function loadState() {
  const stored = await storage.get([
    "knowlense_extension_session",
    "knowlense_settings",
    "knowlense_last_keyword_run",
    "knowlense_connect_request"
  ]);

  state.session = stored.knowlense_extension_session ?? null;
  state.lastKeywordRun = stored.knowlense_last_keyword_run ?? null;
  state.connectRequest = stored.knowlense_connect_request ?? null;
  state.settings = {
    apiUrl: stored.knowlense_settings?.apiUrl || config.apiUrl
  };
}

function apiUrl() {
  return state.settings.apiUrl.replace(/\/$/, "");
}

function setStatus(message, kind = "idle") {
  elements.status.textContent = message;
  elements.status.className = `status${kind === "idle" ? "" : ` ${kind}`}`;
}

function renderAnalysis() {
  const run = state.lastKeywordRun;
  const hasRun = Boolean(run?.analysis?.summary?.query);

  elements.analysisEmpty.classList.toggle("hidden", hasRun);
  elements.analysisCard.classList.toggle("hidden", !hasRun);

  if (!hasRun) {
    return;
  }

  elements.analysisQuery.textContent = run.analysis.summary.query;
  elements.analysisCount.textContent = String(run.analysis.summary.totalResults);
  elements.analysisTopOpportunity.textContent = run.analysis.opportunities[0]?.phrase || "No clear adjacent keyword yet";
  elements.analysisKeywords.innerHTML = "";

  run.analysis.keywords.slice(0, 4).forEach((keyword) => {
    const tag = document.createElement("span");
    tag.className = "analysis-tag";
    tag.textContent = keyword.phrase;
    elements.analysisKeywords.appendChild(tag);
  });
}

function render() {
  const isConnected = Boolean(state.session?.sessionToken);
  elements.apiOrigin.value = state.settings.apiUrl;
  elements.authBadge.textContent = isConnected ? "Connected" : "Disconnected";
  elements.accountView.classList.toggle("hidden", !isConnected);
  elements.connectView.classList.toggle("hidden", isConnected);
  elements.accountEmail.textContent = state.session?.user?.email || "Connected session";
  elements.analyzePage.disabled = !isConnected;
  renderAnalysis();
}

async function persistSession(session) {
  state.session = session;
  await storage.set({ knowlense_extension_session: session });
  render();
}

async function persistSettings() {
  await storage.set({ knowlense_settings: state.settings });
}

async function persistKeywordRun(run) {
  state.lastKeywordRun = run;
  await storage.set({ knowlense_last_keyword_run: run });
  renderAnalysis();
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

  return payload.user;
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

async function analyzeKeywordSnapshot(token, snapshot) {
  const response = await fetch(`${apiUrl()}/v1/keyword-finder/analyze`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(snapshot)
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.analysis) {
    throw new Error(payload?.error || "Keyword Finder analysis failed.");
  }

  return payload;
}

async function extractSnapshotFromCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No active tab is available.");
  }

  if (!tab.url?.includes("teacherspayteachers.com")) {
    throw new Error("Open a TPT search results page before running Keyword Finder.");
  }

  const response = await chrome.tabs.sendMessage(tab.id, { type: "knowlense.extractSearchSnapshot" }).catch(() => null);

  if (!response?.ok || !response.snapshot) {
    throw new Error(response?.error || "Knowlense could not read keyword data from this page.");
  }

  return response.snapshot;
}

async function handleAnalyzePage() {
  if (!state.session?.sessionToken) {
    setStatus("Connect the extension through the website first.", "error");
    return;
  }

  setStatus("Extracting the current TPT search page...");

  try {
    const snapshot = await extractSnapshotFromCurrentTab();
    setStatus("Analyzing keyword opportunities...");
    const analysisPayload = await analyzeKeywordSnapshot(state.session.sessionToken, snapshot);
    await persistKeywordRun(analysisPayload);
    setStatus(analysisPayload.warning || "Keyword Finder completed.", analysisPayload.warning ? "error" : "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function handleRefreshAnalysis() {
  renderAnalysis();
  setStatus(state.lastKeywordRun ? "Showing the latest local Keyword Finder result." : "No local analysis found.");
}

async function handleDisconnect() {
  await persistSession(null);
  setStatus("Extension session removed from this browser.");
}

function attachEvents() {
  elements.settingsToggle.addEventListener("click", () => {
    elements.settingsPanel.classList.toggle("hidden");
  });

  elements.saveSettings.addEventListener("click", async () => {
    state.settings.apiUrl = elements.apiOrigin.value.trim() || config.apiUrl;
    await persistSettings();
    setStatus("Settings saved.", "success");
  });

  elements.openDashboard.addEventListener("click", () => {
    chrome.tabs.create({ url: config.dashboardUrl });
  });

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
  elements.analyzePage.addEventListener("click", handleAnalyzePage);
  elements.refreshAnalysis.addEventListener("click", handleRefreshAnalysis);
}

async function boot() {
  await loadState();

  if (state.session?.sessionToken) {
    try {
      const user = await fetchApiProfile(state.session.sessionToken);
      state.session = { ...state.session, user };
      await storage.set({ knowlense_extension_session: state.session });
      setStatus("Extension session is active.", "success");
    } catch {
      state.session = null;
      await storage.remove("knowlense_extension_session");
      setStatus("Connect this extension through the website to begin.");
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

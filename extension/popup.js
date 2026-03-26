import { config } from "./config.js";

const storage = chrome.storage.local;
const state = {
  session: null,
  settings: {
    apiUrl: config.apiUrl
  },
  lastKeywordRun: null
};

const elements = {
  settingsToggle: document.getElementById("settings-toggle"),
  settingsPanel: document.getElementById("settings-panel"),
  apiOrigin: document.getElementById("api-origin"),
  saveSettings: document.getElementById("save-settings"),
  openDashboard: document.getElementById("open-dashboard"),
  signInForm: document.getElementById("sign-in-form"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  status: document.getElementById("status"),
  authBadge: document.getElementById("auth-badge"),
  accountView: document.getElementById("account-view"),
  accountEmail: document.getElementById("account-email"),
  signOut: document.getElementById("sign-out"),
  openSite: document.getElementById("open-site"),
  createAccount: document.getElementById("create-account"),
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
  const stored = await storage.get(["knowlense_session", "knowlense_settings", "knowlense_last_keyword_run"]);
  state.session = stored.knowlense_session ?? null;
  state.lastKeywordRun = stored.knowlense_last_keyword_run ?? null;
  state.settings = {
    apiUrl: stored.knowlense_settings?.apiUrl || config.apiUrl
  };
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
  elements.analysisTopOpportunity.textContent = run.analysis.opportunities[0]?.phrase || "No strong adjacent term yet";
  elements.analysisKeywords.innerHTML = "";

  run.analysis.keywords.slice(0, 4).forEach((keyword) => {
    const tag = document.createElement("span");
    tag.className = "analysis-tag";
    tag.textContent = keyword.phrase;
    elements.analysisKeywords.appendChild(tag);
  });
}

function render() {
  elements.apiOrigin.value = state.settings.apiUrl;

  const signedIn = Boolean(state.session?.profile?.email || state.session?.user?.email);
  elements.authBadge.textContent = signedIn ? "Signed in" : "Guest";
  elements.accountView.classList.toggle("hidden", !signedIn);
  elements.signInForm.classList.toggle("hidden", signedIn);
  elements.accountEmail.textContent = state.session?.profile?.email || state.session?.user?.email || "";
  elements.analyzePage.disabled = !signedIn;

  if (signedIn) {
    setStatus("Session validated through /v1/me.", "success");
  } else {
    setStatus("Use the same credentials as the website.");
  }

  renderAnalysis();
}

async function persistSession(session) {
  state.session = session;
  await storage.set({ knowlense_session: session });
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

async function signInWithPassword(email, password) {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: config.supabaseAnonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error_description || payload.msg || "Unable to sign in.");
  }

  const userResponse = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${payload.access_token}`
    }
  });

  const user = await userResponse.json();

  if (!userResponse.ok) {
    throw new Error(user.message || "Unable to load account.");
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
    user
  };
}

async function fetchApiProfile(accessToken, apiUrl) {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/v1/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.user) {
    throw new Error(payload?.error || "Unable to validate the current session.");
  }

  return payload.user;
}

async function analyzeKeywordSnapshot(accessToken, apiUrl, snapshot) {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/v1/keyword-finder/analyze`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
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

async function handleSubmit(event) {
  event.preventDefault();

  const email = elements.email.value.trim();
  const password = elements.password.value;

  if (!config.supabaseUrl.includes(".supabase.co") || config.supabaseAnonKey.startsWith("YOUR_")) {
    setStatus("Set Supabase values in extension/config.js first.", "error");
    return;
  }

  setStatus("Signing in...");

  try {
    const session = await signInWithPassword(email, password);
    const profile = await fetchApiProfile(session.accessToken, state.settings.apiUrl);
    await persistSession({ ...session, profile });
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function handleAnalyzePage() {
  if (!state.session?.accessToken) {
    setStatus("Sign in before running Keyword Finder.", "error");
    return;
  }

  setStatus("Extracting the current TPT search page...");

  try {
    const snapshot = await extractSnapshotFromCurrentTab();
    setStatus("Analyzing keyword opportunities...");
    const analysisPayload = await analyzeKeywordSnapshot(state.session.accessToken, state.settings.apiUrl, snapshot);
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

async function handleSignOut() {
  await persistSession(null);
  elements.email.value = "";
  elements.password.value = "";
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

  elements.openSite.addEventListener("click", () => {
    chrome.tabs.create({ url: config.websiteUrl });
  });

  elements.createAccount.addEventListener("click", () => {
    chrome.tabs.create({ url: `${config.websiteUrl}/auth` });
  });

  elements.analyzePage.addEventListener("click", handleAnalyzePage);
  elements.refreshAnalysis.addEventListener("click", handleRefreshAnalysis);
  elements.signInForm.addEventListener("submit", handleSubmit);
  elements.signOut.addEventListener("click", handleSignOut);
}

async function boot() {
  await loadState();
  if (state.session?.accessToken) {
    try {
      const profile = await fetchApiProfile(state.session.accessToken, state.settings.apiUrl);
      state.session = { ...state.session, profile };
    } catch {
      state.session = null;
      await storage.remove("knowlense_session");
    }
  }
  attachEvents();
  render();
}

void boot();

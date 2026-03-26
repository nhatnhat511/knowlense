import { config } from "./config.js";

const storage = chrome.storage.local;
const state = {
  session: null,
  settings: {
    apiUrl: config.apiUrl
  }
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
  createAccount: document.getElementById("create-account")
};

async function loadState() {
  const stored = await storage.get(["knowlense_session", "knowlense_settings"]);
  state.session = stored.knowlense_session ?? null;
  state.settings = {
    apiUrl: stored.knowlense_settings?.apiUrl || config.apiUrl
  };
}

function setStatus(message, kind = "idle") {
  elements.status.textContent = message;
  elements.status.className = `status${kind === "idle" ? "" : ` ${kind}`}`;
}

function render() {
  elements.apiOrigin.value = state.settings.apiUrl;

  const signedIn = Boolean(state.session?.profile?.email || state.session?.user?.email);
  elements.authBadge.textContent = signedIn ? "Signed in" : "Guest";
  elements.accountView.classList.toggle("hidden", !signedIn);
  elements.signInForm.classList.toggle("hidden", signedIn);
  elements.accountEmail.textContent = state.session?.profile?.email || state.session?.user?.email || "";

  if (signedIn) {
    setStatus("Session validated through /v1/me.", "success");
  } else {
    setStatus("Use the same credentials as the website.");
  }
}

async function persistSession(session) {
  state.session = session;
  await storage.set({ knowlense_session: session });
  render();
}

async function persistSettings() {
  await storage.set({ knowlense_settings: state.settings });
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

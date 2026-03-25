const AUTH_STORAGE_KEY = "knowlenseAuth";
const DEFAULT_PLAN = "free";
const RELLOGIN_FLAG_KEY = "knowlenseReloginRequired";

function formatPlanLabel(plan) {
  return plan === "premium" || plan === "paid" || plan === "trial" ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Free";
}

function openKnowlensePage(path = "") {
  chrome.tabs.create({ url: `https://knowlense.com${path}` });
}

function renderLoggedOutState() {
  document.getElementById("planBadge").textContent = formatPlanLabel(DEFAULT_PLAN);
  document.getElementById("accountName").textContent = "Not logged in";
  document.getElementById("accountPlan").textContent = "Login to sync your Knowlense data.";
  document.getElementById("loginNotice").style.display = "block";

  const authButton = document.getElementById("authButton");
  authButton.textContent = "Login to Knowlense.com";
  authButton.onclick = () => openKnowlensePage("/login?source=extension");
}

function renderLoggedInState(session) {
  const displayName =
    session?.profile?.fullName ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    session?.user?.email ||
    "Knowlense user";
  const plan = session?.profile?.plan || DEFAULT_PLAN;

  document.getElementById("planBadge").textContent = formatPlanLabel(plan);
  document.getElementById("accountName").textContent = displayName;
  document.getElementById("accountPlan").textContent = `Subscription: ${formatPlanLabel(plan)}`;
  document.getElementById("loginNotice").style.display = plan === "premium" || plan === "trial" ? "none" : "block";
  document.getElementById("loginNotice").textContent = "Login to access Premium features.";

  const authButton = document.getElementById("authButton");
  authButton.textContent = "Manage account";
  authButton.onclick = () => openKnowlensePage("/app/account");
}

function loadAuthState() {
  chrome.storage.local.get({ [AUTH_STORAGE_KEY]: null }, (result) => {
    const session = result[AUTH_STORAGE_KEY];
    const hasAccessToken = Boolean(session?.accessToken);

    if (!hasAccessToken) {
      renderLoggedOutState();
      return;
    }

    renderLoggedInState(session);
  });
}

function bindRuntimeMessages() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "AUTH_RELOGIN_REQUIRED") {
      return;
    }

    chrome.storage.local.set({ [RELLOGIN_FLAG_KEY]: true });
    document.getElementById("loginNotice").style.display = "block";
    document.getElementById("loginNotice").textContent = "Login to access Premium features.";
  });
}

function bindEvents() {
  document.getElementById("settingsButton").addEventListener("click", () => {
    openKnowlensePage("/settings");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  bindRuntimeMessages();
  loadAuthState();
});

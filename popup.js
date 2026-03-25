const AUTH_STORAGE_KEY = "knowlenseAuth";
const SUBSCRIPTION_STORAGE_KEY = "knowlenseSubscription";
const AUTO_HIGHLIGHT_KEY = "knowlenseAutoHighlightEnabled";
const DEFAULT_PLAN = "free";
const RELLOGIN_FLAG_KEY = "knowlenseReloginRequired";

function formatPlanLabel(plan) {
  return plan === "premium" || plan === "paid" || plan === "trial" ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Free";
}

function openKnowlensePage(path = "") {
  chrome.tabs.create({ url: `https://knowlense.com${path}` });
}

function getLocalState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      {
        [AUTH_STORAGE_KEY]: null,
        [SUBSCRIPTION_STORAGE_KEY]: {
          isPremium: false,
          plan: "free",
          expiresAt: null
        },
        [AUTO_HIGHLIGHT_KEY]: false,
        [RELLOGIN_FLAG_KEY]: false
      },
      resolve
    );
  });
}

function setLocalState(values) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve();
    });
  });
}

function renderLoggedOutState() {
  document.getElementById("planBadge").textContent = formatPlanLabel(DEFAULT_PLAN);
  document.getElementById("accountName").textContent = "Not logged in";
  document.getElementById("accountPlan").textContent = "Manual lookup is available without an account.";
  document.getElementById("loginNotice").style.display = "block";
  document.getElementById("loginNotice").textContent = "Please login at Knowlense.com to enable Auto-Highlight";

  const authButton = document.getElementById("authButton");
  authButton.textContent = "Login to Knowlense.com";
  authButton.onclick = () => openKnowlensePage("/auth");
}

function renderLoggedInState(session, subscription) {
  const displayName =
    session?.profile?.fullName ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    session?.user?.email ||
    "Knowlense user";
  const plan = subscription?.plan || session?.profile?.plan || DEFAULT_PLAN;

  document.getElementById("planBadge").textContent = formatPlanLabel(plan);
  document.getElementById("accountName").textContent = displayName;
  document.getElementById("accountPlan").textContent = subscription?.expiresAt
    ? `Subscription: ${formatPlanLabel(plan)} · Renews ${new Date(subscription.expiresAt).toLocaleDateString("en-US")}`
    : `Subscription: ${formatPlanLabel(plan)}`;

  const authButton = document.getElementById("authButton");
  authButton.textContent = "Manage account";
  authButton.onclick = () => openKnowlensePage("/dashboard");
}

async function renderPopupState() {
  const state = await getLocalState();
  const session = state[AUTH_STORAGE_KEY];
  const subscription = state[SUBSCRIPTION_STORAGE_KEY];
  const autoHighlightEnabled = Boolean(state[AUTO_HIGHLIGHT_KEY]);
  const toggle = document.getElementById("autoHighlightToggle");

  toggle.checked = autoHighlightEnabled;

  if (!session?.accessToken) {
    renderLoggedOutState();
    return;
  }

  renderLoggedInState(session, subscription);

  const notice = document.getElementById("loginNotice");
  notice.style.display = subscription?.isPremium ? "none" : "block";
  notice.textContent = subscription?.isPremium
    ? ""
    : "Upgrade to Premium for Auto-Highlight";
}

function bindRuntimeMessages() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "AUTH_RELOGIN_REQUIRED") {
      return;
    }

    chrome.storage.local.set({ [RELLOGIN_FLAG_KEY]: true });
    document.getElementById("loginNotice").style.display = "block";
    document.getElementById("loginNotice").textContent = "Please login at Knowlense.com to enable Auto-Highlight";
    document.getElementById("autoHighlightToggle").checked = false;
  });
}

function bindEvents() {
  document.getElementById("settingsButton").addEventListener("click", () => {
    openKnowlensePage("/dashboard");
  });

  document.getElementById("autoHighlightToggle").addEventListener("change", async (event) => {
    const toggle = event.target;
    const nextValue = Boolean(toggle.checked);
    const state = await getLocalState();
    const session = state[AUTH_STORAGE_KEY];

    if (!session?.accessToken) {
      toggle.checked = false;
      document.getElementById("loginNotice").style.display = "block";
      document.getElementById("loginNotice").textContent = "Please login at Knowlense.com to enable Auto-Highlight";
      return;
    }

    if (!nextValue) {
      await setLocalState({ [AUTO_HIGHLIGHT_KEY]: false });
      document.getElementById("loginNotice").style.display = "none";
      return;
    }

    chrome.runtime.sendMessage({ type: "ENABLE_AUTO_HIGHLIGHT" }, async (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        toggle.checked = false;
        await setLocalState({ [AUTO_HIGHLIGHT_KEY]: false });
        document.getElementById("loginNotice").style.display = "block";
        document.getElementById("loginNotice").textContent =
          response?.error || "Upgrade to Premium for Auto-Highlight";
        return;
      }

      await setLocalState({ [AUTO_HIGHLIGHT_KEY]: true });
      document.getElementById("loginNotice").style.display = "none";
      renderPopupState();
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  bindRuntimeMessages();
  await renderPopupState();
  chrome.runtime.sendMessage({ type: "SYNC_SUBSCRIPTION_STATE" }, () => {
    void renderPopupState();
  });
});

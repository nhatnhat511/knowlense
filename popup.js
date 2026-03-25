const AUTH_STORAGE_KEY = "knowlenseAuth";
const DEFAULT_PLAN = "free";

function formatPlanLabel(plan) {
  return plan === "premium" || plan === "paid" ? "Trả phí" : "Miễn phí";
}

function openKnowlensePage(path = "") {
  chrome.tabs.create({ url: `https://knowlense.com${path}` });
}

function renderLoggedOutState() {
  document.getElementById("planBadge").textContent = formatPlanLabel(DEFAULT_PLAN);
  document.getElementById("accountName").textContent = "Chưa đăng nhập";
  document.getElementById("accountPlan").textContent = "Đăng nhập tại Knowlense.com để đồng bộ dữ liệu.";

  const authButton = document.getElementById("authButton");
  authButton.textContent = "Đăng nhập tại Knowlense.com";
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
  document.getElementById("accountPlan").textContent = `Gói dịch vụ: ${formatPlanLabel(plan)}`;

  const authButton = document.getElementById("authButton");
  authButton.textContent = "Quản lý tài khoản";
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

function bindEvents() {
  document.getElementById("settingsButton").addEventListener("click", () => {
    openKnowlensePage("/settings");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadAuthState();
});

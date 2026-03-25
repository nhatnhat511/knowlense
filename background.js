const WIKIPEDIA_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const API_BASE_URL = "https://api.knowlense.com";
const AUTH_STORAGE_KEY = "knowlenseAuth";
const SUBSCRIPTION_STORAGE_KEY = "knowlenseSubscription";
const AUTO_HIGHLIGHT_KEY = "knowlenseAutoHighlightEnabled";
const RELLOGIN_FLAG_KEY = "knowlenseReloginRequired";
const SUBSCRIPTION_ALARM_NAME = "knowlense-sync-subscription";
const TWELVE_HOURS_IN_MINUTES = 60 * 12;
const SUMMARY_CHARACTER_LIMIT = 420;

const EXCLUDED_HOST_PATTERNS = [
  /paypal\./i,
  /stripe\./i,
  /bank/i,
  /banking/i,
  /finance/i,
  /payment/i,
  /checkout/i,
  /wallet/i,
  /wise\.com$/i,
  /revolut\./i
];

async function fetchWikipediaSummary(keyword) {
  const normalizedKeyword = String(keyword || "").trim();

  if (!normalizedKeyword) {
    throw new Error("Keyword is empty.");
  }

  const response = await fetch(`${WIKIPEDIA_SUMMARY_URL}${encodeURIComponent(normalizedKeyword)}`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (response.status === 404) {
    throw new Error(`No Wikipedia page found for "${normalizedKeyword}".`);
  }

  if (!response.ok) {
    throw new Error(`Wikipedia request failed with status ${response.status}.`);
  }

  const data = await response.json();

  if (!data.extract) {
    throw new Error(`No summary available for "${normalizedKeyword}".`);
  }

  return {
    keyword: normalizedKeyword,
    extract: buildCompleteSummary(data.extract, SUMMARY_CHARACTER_LIMIT),
    source: data.content_urls?.desktop?.page || ""
  };
}

function trimToTwoSentences(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  const sentences = normalized.match(/[^.!?]+[.!?]+/g) || [normalized];
  return sentences.slice(0, 2).join(" ").trim();
}

function buildCompleteSummary(text, limit = SUMMARY_CHARACTER_LIMIT) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  const twoSentenceSummary = trimToTwoSentences(normalized);
  if (twoSentenceSummary.length <= limit) {
    return cleanSentenceEnding(twoSentenceSummary);
  }

  const candidate = twoSentenceSummary.slice(0, limit);
  const lastSentenceBoundary = Math.max(
    candidate.lastIndexOf("."),
    candidate.lastIndexOf("!"),
    candidate.lastIndexOf("?")
  );

  if (lastSentenceBoundary > Math.floor(limit * 0.45)) {
    return cleanSentenceEnding(candidate.slice(0, lastSentenceBoundary + 1));
  }

  const lastWordBoundary = candidate.lastIndexOf(" ");
  const safeSlice = lastWordBoundary > 0 ? candidate.slice(0, lastWordBoundary) : candidate;

  return cleanSentenceEnding(safeSlice);
}

function cleanSentenceEnding(text) {
  let cleaned = String(text || "").replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/\.{3,}\s*$/, "");
  cleaned = cleaned.replace(/[,;:]\s*$/, "");

  if (!cleaned) {
    return "";
  }

  if (!/[.!?]$/.test(cleaned)) {
    cleaned += ".";
  }

  return cleaned;
}

function normalizeAuthPayload(payload) {
  const accessToken = payload?.accessToken || payload?.session?.access_token || "";
  const refreshToken = payload?.refreshToken || payload?.session?.refresh_token || "";
  const user = payload?.user || payload?.session?.user || null;
  const profile = payload?.profile || null;
  const plan = profile?.plan || payload?.plan || "free";

  if (!accessToken || !user) {
    throw new Error("Missing access token or user payload.");
  }

  return {
    accessToken,
    refreshToken,
    user,
    profile: {
      fullName: profile?.fullName || user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Knowlense user",
      plan
    },
    updatedAt: new Date().toISOString()
  };
}

function getStorage(defaults) {
  return new Promise((resolve) => {
    chrome.storage.local.get(defaults, (result) => resolve(result));
  });
}

function setStorage(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve();
    });
  });
}

function removeStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve();
    });
  });
}

function buildSubscriptionSnapshot(payload) {
  const subscription = payload?.subscription || {};
  const state = subscription?.state || "free";
  const plan = subscription?.billingPlan || subscription?.plan || state;
  const expiresAt = subscription?.currentPeriodEnd || subscription?.trialEndsAt || null;

  return {
    isPremium: state === "premium" || state === "trial",
    plan,
    expiresAt
  };
}

function isExcludedUrl(url) {
  try {
    const { hostname } = new URL(url);
    return EXCLUDED_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
  } catch (error) {
    return true;
  }
}

async function getStoredAuth() {
  const result = await getStorage({ [AUTH_STORAGE_KEY]: null });
  return result[AUTH_STORAGE_KEY];
}

async function syncSubscriptionState() {
  const auth = await getStoredAuth();
  const accessToken = auth?.accessToken || auth?.session?.access_token || "";

  if (!accessToken) {
    await setStorage({
      [SUBSCRIPTION_STORAGE_KEY]: {
        isPremium: false,
        plan: "free",
        expiresAt: null
      }
    });

    return {
      ok: false,
      error: "User not logged in"
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/subscription/status`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });

    const payload = await response.json().catch(() => ({}));

    if (response.status === 401) {
      await setStorage({ [RELLOGIN_FLAG_KEY]: true });
      chrome.runtime.sendMessage({ type: "AUTH_RELOGIN_REQUIRED" });
      throw new Error("Unauthorized. Please log in again.");
    }

    if (!response.ok) {
      throw new Error(payload?.error || `Subscription sync failed with status ${response.status}`);
    }

    const snapshot = buildSubscriptionSnapshot(payload);
    await setStorage({
      [SUBSCRIPTION_STORAGE_KEY]: snapshot,
      [RELLOGIN_FLAG_KEY]: false
    });

    return {
      ok: true,
      subscription: snapshot
    };
  } catch (error) {
    console.error("Failed to sync subscription state:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to sync subscription state."
    };
  }
}

async function checkUserPermission() {
  const [{ [AUTO_HIGHLIGHT_KEY]: autoHighlightEnabled }, { [SUBSCRIPTION_STORAGE_KEY]: subscription }] = await Promise.all([
    getStorage({ [AUTO_HIGHLIGHT_KEY]: false }),
    getStorage({
      [SUBSCRIPTION_STORAGE_KEY]: {
        isPremium: false,
        plan: "free",
        expiresAt: null
      }
    })
  ]);

  if (!autoHighlightEnabled) {
    return { allowed: false, reason: "Auto-Highlight disabled" };
  }

  const syncResult = await syncSubscriptionState();
  const latestSubscription = syncResult?.subscription || subscription;

  if (!latestSubscription?.isPremium) {
    return { allowed: false, reason: "Upgrade to Premium for Auto-Highlight" };
  }

  return { allowed: true, subscription: latestSubscription };
}

async function injectAutoHighlightOnActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url) {
    return { ok: false, error: "No active tab available." };
  }

  if (isExcludedUrl(tab.url)) {
    return { ok: false, error: "Auto-Highlight is disabled on banking and finance pages." };
  }

  const permission = await checkUserPermission();

  if (!permission.allowed) {
    return { ok: false, error: permission.reason };
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["autoHighlightEngine.js"]
  });

  return {
    ok: true,
    subscription: permission.subscription
  };
}

function ensureSubscriptionAlarm() {
  chrome.alarms.create(SUBSCRIPTION_ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: TWELVE_HOURS_IN_MINUTES
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureSubscriptionAlarm();
  void syncSubscriptionState();
});

chrome.runtime.onStartup.addListener(() => {
  ensureSubscriptionAlarm();
  void syncSubscriptionState();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SUBSCRIPTION_ALARM_NAME) {
    void syncSubscriptionState();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "FETCH_WIKIPEDIA_SUMMARY") {
    fetchWikipediaSummary(message.keyword)
      .then((result) => sendResponse({ ok: true, data: result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message?.type === "SYNC_SUBSCRIPTION_STATE") {
    syncSubscriptionState().then(sendResponse);
    return true;
  }

  if (message?.type === "ENABLE_AUTO_HIGHLIGHT") {
    injectAutoHighlightOnActiveTab().then(sendResponse);
    return true;
  }

  return false;
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message?.type === "AUTH_SESSION_UPDATED") {
    let session;

    try {
      session = normalizeAuthPayload(message.payload);
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
      return false;
    }

    setStorage({ [AUTH_STORAGE_KEY]: session })
      .then(() => syncSubscriptionState())
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message?.type === "AUTH_LOGOUT") {
    removeStorage([AUTH_STORAGE_KEY, SUBSCRIPTION_STORAGE_KEY, AUTO_HIGHLIGHT_KEY])
      .then(() =>
        setStorage({
          [RELLOGIN_FLAG_KEY]: false
        })
      )
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  return false;
});

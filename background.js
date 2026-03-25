const WIKIPEDIA_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const API_BASE_URL = "https://api.knowlense.com";
const AUTH_STORAGE_KEY = "knowlenseAuth";
const SUBSCRIPTION_STORAGE_KEY = "knowlenseSubscription";
const RELLOGIN_FLAG_KEY = "knowlenseReloginRequired";
const SUBSCRIPTION_ALARM_NAME = "knowlense-sync-subscription";
const SIX_HOURS_IN_MINUTES = 60 * 6;

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
    extract: data.extract,
    source: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(normalizedKeyword)}`
  };
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

function getStoredAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [AUTH_STORAGE_KEY]: null }, (result) => {
      resolve(result[AUTH_STORAGE_KEY]);
    });
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

async function syncSubscriptionState() {
  const auth = await getStoredAuth();
  const accessToken = auth?.accessToken || auth?.session?.access_token || "";

  if (!accessToken) {
    console.error("User not logged in");
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

function ensureSubscriptionAlarm() {
  chrome.alarms.create(SUBSCRIPTION_ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: SIX_HOURS_IN_MINUTES
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
    removeStorage([AUTH_STORAGE_KEY, SUBSCRIPTION_STORAGE_KEY])
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

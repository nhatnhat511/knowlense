const WIKIPEDIA_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const AUTH_STORAGE_KEY = "knowlenseAuth";

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "FETCH_WIKIPEDIA_SUMMARY") {
    return false;
  }

  fetchWikipediaSummary(message.keyword)
    .then((result) => sendResponse({ ok: true, data: result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
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

    chrome.storage.local.set({ [AUTH_STORAGE_KEY]: session }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      sendResponse({ ok: true });
    });

    return true;
  }

  if (message?.type === "AUTH_LOGOUT") {
    chrome.storage.local.remove(AUTH_STORAGE_KEY, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      sendResponse({ ok: true });
    });

    return true;
  }

  return false;
});

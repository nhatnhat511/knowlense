const API_BASE_URL = "https://api.knowlense.com";
const AUTH_STORAGE_KEY = "knowlenseAuth";

function getStoredAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [AUTH_STORAGE_KEY]: null }, (result) => {
      resolve(result[AUTH_STORAGE_KEY]);
    });
  });
}

async function getAccessToken() {
  const auth = await getStoredAuth();
  const accessToken = auth?.accessToken || auth?.session?.access_token || "";

  if (!accessToken) {
    console.error("User not logged in");
    throw new Error("User not logged in");
  }

  return accessToken;
}

function notifyReauthRequired() {
  chrome.runtime.sendMessage({
    type: "AUTH_RELOGIN_REQUIRED"
  });
}

async function apiRequest(path, options = {}) {
  try {
    const accessToken = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (response.status === 401) {
      notifyReauthRequired();
      throw new Error("Unauthorized. Please log in again.");
    }

    if (!response.ok) {
      const message =
        typeof payload === "object" && payload?.error
          ? payload.error
          : `Request failed with status ${response.status}`;

      throw new Error(message);
    }

    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    console.error("API request failed:", message);

    return {
      ok: false,
      error: message
    };
  }
}

export async function checkSubscriptionStatus() {
  return apiRequest("/api/subscription/status");
}

export async function syncUserSettings(settings) {
  return apiRequest("/api/user/settings", {
    method: "POST",
    body: settings
  });
}

export async function getTermDefinition(term) {
  const normalizedTerm = String(term || "").trim();

  if (!normalizedTerm) {
    return {
      ok: false,
      error: "Term is required."
    };
  }

  return apiRequest(`/api/wiki/search?term=${encodeURIComponent(normalizedTerm)}`);
}

export { API_BASE_URL };

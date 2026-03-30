import { config } from "./config.js";

const TPT_BASE_URL = "https://www.teacherspayteachers.com";
const SEARCH_INDEX_ENGINES = [
  {
    id: "google",
    name: "Google",
    buildUrl(query) {
      return `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10&hl=en`;
    }
  },
  {
    id: "bing",
    name: "Bing",
    buildUrl(query) {
      return `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10&setlang=en-US`;
    }
  },
  {
    id: "yahoo",
    name: "Yahoo",
    buildUrl(query) {
      return `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
    }
  },
  {
    id: "brave",
    name: "Brave",
    buildUrl(query) {
      return `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
    }
  }
];
const STORAGE_KEYS = {
  session: "knowlense_extension_session",
  connectRequest: "knowlense_connect_request",
  settings: "knowlense_settings",
  trackedTargets: "knowlense_rank_tracking_targets",
  pendingChecks: "knowlense_rank_tracking_pending_checks",
  lastSweepDate: "knowlense_rank_tracking_last_sweep_date"
};
const PROCESS_LOCK_KEY = "knowlense-rank-tracking-lock";

let activeSweep = null;
let activeConnectPoll = null;

function normalizeText(value) {
  return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeProductUrl(value) {
  try {
    const url = new URL(value, TPT_BASE_URL);
    return `${url.origin}${url.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return String(value || "").trim().replace(/\/$/, "").toLowerCase();
  }
}

function extractProductId(value) {
  return value.match(/\/(\d+)(?:[/?#]|$)/)?.[1] ?? null;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function buildSearchSiteOperand(productUrl) {
  return normalizeProductUrl(productUrl);
}

function unwrapCandidateUrl(rawHref, baseUrl) {
  const decoded = decodeHtmlEntities(rawHref ?? "");
  if (!decoded) {
    return "";
  }

  try {
    const parsed = new URL(decoded, baseUrl);
    if (parsed.pathname === "/url" && (parsed.searchParams.get("q") || parsed.searchParams.get("url"))) {
      return parsed.searchParams.get("q") || parsed.searchParams.get("url") || "";
    }
    if (parsed.searchParams.get("uddg")) {
      return decodeURIComponent(parsed.searchParams.get("uddg") || "");
    }
    return parsed.toString();
  } catch {
    return decoded;
  }
}

function detectSearchChallenge(text) {
  const normalized = normalizeText(text);
  return (
    normalized.includes("sending automated queries") ||
    normalized.includes("unusual traffic") ||
    normalized.includes("recaptcha") ||
    normalized.includes("captcha") ||
    normalized.includes("verify you are human") ||
    normalized.includes("detected unusual traffic")
  );
}

function waitForTabLoad(tabId, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(false);
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId || changeInfo.status !== "complete" || settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(true);
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function collectSearchResultLinks(searchUrl) {
  const tab = await chrome.tabs.create({
    url: searchUrl,
    active: false
  });

  try {
    await waitForTabLoad(tab.id);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const hrefs = [...document.querySelectorAll("a[href]")]
          .map((anchor) => anchor.getAttribute("href") || anchor.href || "")
          .filter(Boolean);
        return {
          hrefs,
          bodyText: (document.body?.innerText || "").slice(0, 10000)
        };
      }
    });

    const payload = results?.[0]?.result ?? { hrefs: [], bodyText: "" };
    return payload;
  } finally {
    if (tab.id) {
      await chrome.tabs.remove(tab.id).catch(() => null);
    }
  }
}

function hasMatchingProductUrl(hrefs, searchUrl, productUrl) {
  const normalizedProductUrl = normalizeProductUrl(productUrl);
  return hrefs.some((href) => {
    const candidate = unwrapCandidateUrl(href, searchUrl);
    return candidate && normalizeProductUrl(candidate) === normalizedProductUrl;
  });
}

async function runSearchIndexCheck(productUrl) {
  const query = `site:${buildSearchSiteOperand(productUrl)}`;
  const checks = [];

  for (const engine of SEARCH_INDEX_ENGINES) {
    try {
      const searchUrl = engine.buildUrl(query);
      const payload = await collectSearchResultLinks(searchUrl);
      if (detectSearchChallenge(payload.bodyText)) {
        checks.push({
          id: engine.id,
          label: engine.name,
          passed: false,
          status: "challenge",
          message: `${engine.name}: Knowlense could not verify this product because the search engine returned an anti-bot or challenge page.`
        });
        continue;
      }
      const found = hasMatchingProductUrl(payload.hrefs || [], searchUrl, productUrl);

      checks.push({
        id: engine.id,
        label: engine.name,
        passed: found,
        status: found ? "found" : "not_found",
        message: found
          ? `${engine.name}: This product appears in ${engine.name} search results for the current indexing check.`
          : `${engine.name}: This product was not found in ${engine.name} search results for the current indexing check.`
      });
    } catch {
      checks.push({
        id: engine.id,
        label: engine.name,
        passed: false,
        status: "request_error",
        message: `${engine.name}: Knowlense could not verify this product during the current indexing check.`
      });
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    checks
  };
}

function extractProductUrlsFromSearchHtml(html) {
  const matches = [...html.matchAll(/href="([^"]*\/Product\/[^"]+)"/g)];
  const seen = new Set();
  const urls = [];

  for (const match of matches) {
    const decoded = decodeHtmlEntities(match[1] ?? "");
    if (!decoded) {
      continue;
    }

    const href = new URL(decoded, TPT_BASE_URL).toString();
    if (seen.has(href)) {
      continue;
    }

    seen.add(href);
    urls.push(href);
  }

  return urls;
}

function currentLocalDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelayMs() {
  return 8000 + Math.floor(Math.random() * 12001);
}

function apiUrl(settings) {
  return (settings?.apiUrl || config.apiUrl).replace(/\/$/, "");
}

function isFreshConnectRequest(request) {
  if (!request?.requestId) {
    return false;
  }

  const expiresAt = typeof request.expiresAt === "string" ? new Date(request.expiresAt).getTime() : NaN;
  if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) {
    return false;
  }

  const startedAt = typeof request.startedAt === "number" ? request.startedAt : 0;
  return startedAt > 0 && Date.now() - startedAt < 10 * 60 * 1000;
}

async function loadRuntimeState() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.session,
    STORAGE_KEYS.connectRequest,
    STORAGE_KEYS.settings,
    STORAGE_KEYS.trackedTargets,
    STORAGE_KEYS.pendingChecks,
    STORAGE_KEYS.lastSweepDate,
    PROCESS_LOCK_KEY
  ]);

  return {
    session: stored[STORAGE_KEYS.session] ?? null,
    connectRequest: stored[STORAGE_KEYS.connectRequest] ?? null,
    settings: stored[STORAGE_KEYS.settings] ?? { apiUrl: config.apiUrl },
    targets: Array.isArray(stored[STORAGE_KEYS.trackedTargets]) ? stored[STORAGE_KEYS.trackedTargets] : [],
    pendingChecks: Array.isArray(stored[STORAGE_KEYS.pendingChecks]) ? stored[STORAGE_KEYS.pendingChecks] : [],
    lastSweepDate: stored[STORAGE_KEYS.lastSweepDate] ?? null,
    lock: stored[PROCESS_LOCK_KEY] ?? null
  };
}

async function pollExtensionConnection(reason = "manual") {
  if (activeConnectPoll) {
    return activeConnectPoll;
  }

  activeConnectPoll = (async () => {
    let state = await loadRuntimeState();
    if (!isFreshConnectRequest(state.connectRequest)) {
      if (state.connectRequest) {
        await chrome.storage.local.remove(STORAGE_KEYS.connectRequest);
      }
      return;
    }

    const timeoutAt = Date.now() + 10 * 60 * 1000;
    let delayMs = 2000;

    while (Date.now() < timeoutAt) {
      state = await loadRuntimeState();
      if (!isFreshConnectRequest(state.connectRequest)) {
        await chrome.storage.local.remove(STORAGE_KEYS.connectRequest);
        return;
      }

      try {
        const response = await fetch(`${apiUrl(state.settings)}/v1/extension/session/poll?requestId=${encodeURIComponent(state.connectRequest.requestId)}&t=${Date.now()}`, {
          cache: "no-store"
        });
        const payload = await response.json().catch(() => null);

        if (response.ok && payload?.status === "connected" && payload?.sessionToken) {
          await chrome.storage.local.set({
            [STORAGE_KEYS.session]: {
              sessionToken: payload.sessionToken,
              user: payload.user,
              billing: payload.billing ?? null,
              expiresAt: payload.expiresAt
            }
          });
          await chrome.storage.local.remove(STORAGE_KEYS.connectRequest);
          return;
        }

        if (response.ok && payload?.status === "expired") {
          await chrome.storage.local.remove(STORAGE_KEYS.connectRequest);
          return;
        }
      } catch {
        // Retry until the request window expires.
      }

      await sleep(delayMs);
      delayMs = Math.min(delayMs + 1000, 5000);
    }
  })().finally(() => {
    activeConnectPoll = null;
  });

  return activeConnectPoll;
}

async function persistTargets(targets) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.trackedTargets]: targets
  });
}

async function persistPendingChecks(pendingChecks) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.pendingChecks]: pendingChecks
  });
}

async function persistLastSweepDate(dateKey) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.lastSweepDate]: dateKey
  });
}

function needsCheckToday(target) {
  if (!target?.isActive) {
    return false;
  }

  const checkedAt = target.lastCheckedAt || target.localLastCheckedAt || null;
  if (!checkedAt) {
    return true;
  }

  const checkedDate = new Date(checkedAt);
  if (Number.isNaN(checkedDate.getTime())) {
    return true;
  }

  const today = currentLocalDateKey();
  const year = checkedDate.getFullYear();
  const month = String(checkedDate.getMonth() + 1).padStart(2, "0");
  const day = String(checkedDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` !== today;
}

function mergeTargets(localTargets, remoteTargets) {
  const localById = new Map(localTargets.map((target) => [target.id, target]));
  return remoteTargets.map((target) => {
    const local = localById.get(target.id);
    if (!local) {
      return target;
    }

    const localCheckedAt = local.lastCheckedAt || local.localLastCheckedAt;
    const remoteCheckedAt = target.lastCheckedAt;
    const useLocal =
      localCheckedAt &&
      (!remoteCheckedAt || new Date(localCheckedAt).getTime() > new Date(remoteCheckedAt).getTime());

    return useLocal
      ? {
          ...target,
          lastCheckedAt: localCheckedAt,
          lastStatus: local.lastStatus ?? target.lastStatus,
          lastResultPage: local.lastResultPage ?? target.lastResultPage,
          lastPagePosition: local.lastPagePosition ?? target.lastPagePosition,
          lastSearchUrl: local.lastSearchUrl ?? target.lastSearchUrl,
          localLastCheckedAt: localCheckedAt
        }
      : {
          ...target,
          localLastCheckedAt: local.localLastCheckedAt ?? null
        };
  });
}

async function refreshTargetsFromBackend(state) {
  const sessionToken = state.session?.sessionToken;
  if (!sessionToken) {
    return state.targets;
  }

  try {
    const response = await fetch(`${apiUrl(state.settings)}/v1/rank-tracking/targets?activeOnly=true`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`
      }
    });
    const payload = await response.json().catch(() => null);

    if (response.status === 401) {
      await chrome.storage.local.remove(STORAGE_KEYS.session);
      return state.targets;
    }

    if (!response.ok || !Array.isArray(payload?.targets)) {
      return state.targets;
    }

    const merged = mergeTargets(state.targets, payload.targets);
    await persistTargets(merged);
    return merged;
  } catch {
    return state.targets;
  }
}

async function flushPendingChecks(state) {
  const sessionToken = state.session?.sessionToken;
  if (!sessionToken || !state.pendingChecks.length) {
    return {
      targets: state.targets,
      pendingChecks: state.pendingChecks
    };
  }

  const targetsById = new Map(state.targets.map((target) => [target.id, target]));
  const remaining = [];

  for (const pending of state.pendingChecks) {
    try {
      const response = await fetch(`${apiUrl(state.settings)}/v1/rank-tracking/checks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          targetId: pending.targetId,
          check: {
            checkedAt: pending.checkedAt,
            status: pending.status,
            resultPage: pending.resultPage,
            pagePosition: pending.pagePosition,
            searchUrl: pending.searchUrl
          }
        })
      });
      const payload = await response.json().catch(() => null);

      if (response.status === 401) {
        await chrome.storage.local.remove(STORAGE_KEYS.session);
        remaining.push(pending);
        break;
      }

      if (!response.ok || !payload?.target) {
        remaining.push(pending);
        continue;
      }

      targetsById.set(payload.target.id, payload.target);
    } catch {
      remaining.push(pending);
    }
  }

  const targets = [...targetsById.values()];
  await Promise.all([persistTargets(targets), persistPendingChecks(remaining)]);
  return { targets, pendingChecks: remaining };
}

async function storePendingCheck(target, check) {
  const state = await loadRuntimeState();
  const updatedTarget = {
    ...target,
    lastCheckedAt: check.checkedAt,
    localLastCheckedAt: check.checkedAt,
    lastStatus: check.status,
    lastResultPage: check.resultPage,
    lastPagePosition: check.pagePosition,
    lastSearchUrl: check.searchUrl
  };
  const targets = state.targets.map((candidate) => (candidate.id === target.id ? updatedTarget : candidate));
  const pendingChecks = [...state.pendingChecks, { targetId: target.id, ...check }];

  await Promise.all([persistTargets(targets), persistPendingChecks(pendingChecks)]);
  return { targets, pendingChecks };
}

async function scanKeywordSearch(productUrl, keyword) {
  const normalizedProductUrl = normalizeProductUrl(productUrl);
  const productId = extractProductId(normalizedProductUrl);
  const searchUrl = `${TPT_BASE_URL}/browse?search=${encodeURIComponent(keyword)}`;

  for (let page = 1; page <= 3; page += 1) {
    const pageUrl = page === 1 ? searchUrl : `${searchUrl}&page=${page}`;
    const response = await fetch(pageUrl, {
      credentials: "include"
    });

    if (!response.ok) {
      continue;
    }

    const html = await response.text();
    const urls = extractProductUrlsFromSearchHtml(html);

    for (let index = 0; index < urls.length; index += 1) {
      const candidateUrl = normalizeProductUrl(urls[index]);
      const candidateId = extractProductId(candidateUrl);
      if (candidateUrl === normalizedProductUrl || (productId && candidateId && candidateId === productId)) {
        return {
          checkedAt: new Date().toISOString(),
          status: "ranked",
          resultPage: page,
          pagePosition: index + 1,
          searchUrl
        };
      }
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    status: "beyond_page_3",
    resultPage: null,
    pagePosition: null,
    searchUrl
  };
}

function pickNextDueTarget(targets) {
  return [...targets]
    .filter(needsCheckToday)
    .sort((left, right) => {
      const leftTime = new Date(left.lastCheckedAt || left.localLastCheckedAt || 0).getTime() || 0;
      const rightTime = new Date(right.lastCheckedAt || right.localLastCheckedAt || 0).getTime() || 0;
      return leftTime - rightTime;
    })[0] || null;
}

async function runOneTarget(target) {
  const check = await scanKeywordSearch(target.productUrl, target.keyword);
  const queued = await storePendingCheck(target, check);
  await flushPendingChecks({
    ...(await loadRuntimeState()),
    targets: queued.targets,
    pendingChecks: queued.pendingChecks
  });
}

async function processDueTargets(reason = "startup") {
  if (activeSweep) {
    return activeSweep;
  }

  activeSweep = (async () => {
    const today = currentLocalDateKey();
    const initialState = await loadRuntimeState();
    let targets = await refreshTargetsFromBackend(initialState);
    const flushed = await flushPendingChecks({
      ...initialState,
      targets
    });
    targets = flushed.targets;

    if (!targets.length) {
      await persistLastSweepDate(today);
      return;
    }

    let target = pickNextDueTarget(targets);
    while (target) {
      await runOneTarget(target);
      targets = (await loadRuntimeState()).targets;
      target = pickNextDueTarget(targets);
      if (target) {
        await sleep(randomDelayMs());
      }
    }

    await persistLastSweepDate(today);
  })().finally(async () => {
    activeSweep = null;
  });

  return activeSweep;
}

async function upsertTrackedTarget(target) {
  const state = await loadRuntimeState();
  const targetsById = new Map(state.targets.map((item) => [item.id, item]));
  targetsById.set(target.id, {
    ...targetsById.get(target.id),
    ...target,
    isActive: true
  });
  await persistTargets([...targetsById.values()]);
}

async function removeTrackedTarget(targetId) {
  const state = await loadRuntimeState();
  await persistTargets(state.targets.filter((target) => target.id !== targetId));
  await persistPendingChecks(state.pendingChecks.filter((check) => check.targetId !== targetId));
}

chrome.runtime.onStartup.addListener(() => {
  void pollExtensionConnection("startup");
  void processDueTargets("startup");
});

chrome.runtime.onInstalled.addListener(() => {
  void pollExtensionConnection("installed");
  void processDueTargets("installed");
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (changes[STORAGE_KEYS.session]) {
    void processDueTargets("session-change");
  }

  if (changes[STORAGE_KEYS.connectRequest]?.newValue) {
    void pollExtensionConnection("storage-change");
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "knowlense.extensionConnect.wakeup") {
    void pollExtensionConnection("message")
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to continue the extension connection." }));
    return true;
  }

  if (message?.type === "knowlense.rankTracking.upsertTarget" && message.target) {
    void upsertTrackedTarget(message.target)
      .then(() => processDueTargets("target-upsert"))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to update tracked target." }));
    return true;
  }

  if (message?.type === "knowlense.rankTracking.removeTarget" && message.targetId) {
    void removeTrackedTarget(message.targetId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to remove tracked target." }));
    return true;
  }

  if (message?.type === "knowlense.rankTracking.wakeup") {
    void processDueTargets("wakeup")
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to run keyword tracking." }));
    return true;
  }

  if (message?.type === "knowlense.searchIndexing.check" && message.productUrl) {
    void runSearchIndexCheck(message.productUrl)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unable to run search indexing check." }));
    return true;
  }

  return undefined;
});

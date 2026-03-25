const FLOATING_BOX_ID = "knowlense-floating-box";
const LOOKUP_ICON_ID = "knowlense-lookup-icon";

let latestPointer = { x: 0, y: 0 };
let currentSelection = "";
let subscriptionState = "free";
let apiServicePromise = null;

function loadApiService() {
  if (!apiServicePromise) {
    apiServicePromise = import(chrome.runtime.getURL("apiService.js"));
  }

  return apiServicePromise;
}

function removeElementById(id) {
  const node = document.getElementById(id);
  if (node) {
    node.remove();
  }
}

function removeFloatingBox() {
  removeElementById(FLOATING_BOX_ID);
}

function removeLookupIcon() {
  removeElementById(LOOKUP_ICON_ID);
}

function getSafePosition(pointerX, pointerY, boxWidth, boxHeight) {
  const gap = 14;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = pointerX + gap;
  let top = pointerY + gap;

  if (left + boxWidth > viewportWidth - gap) {
    left = Math.max(gap, pointerX - boxWidth - gap);
  }

  if (top + boxHeight > viewportHeight - gap) {
    top = Math.max(gap, pointerY - boxHeight - gap);
  }

  left = Math.max(gap, Math.min(left, viewportWidth - boxWidth - gap));
  top = Math.max(gap, Math.min(top, viewportHeight - boxHeight - gap));

  return { left, top };
}

function formatSummary(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  return normalized.length > 320 ? `${normalized.slice(0, 317)}...` : normalized;
}

function createFloatingBox(pointerX, pointerY, summaryText, sourceUrl) {
  removeFloatingBox();

  const box = document.createElement("div");
  box.id = FLOATING_BOX_ID;
  box.setAttribute("role", "dialog");
  box.style.position = "fixed";
  box.style.zIndex = "2147483647";
  box.style.width = "340px";
  box.style.maxWidth = "calc(100vw - 28px)";
  box.style.padding = "16px";
  box.style.borderRadius = "12px";
  box.style.border = "1px solid rgba(203, 213, 225, 0.9)";
  box.style.background = "#ffffff";
  box.style.boxShadow = "0 18px 38px rgba(15, 23, 42, 0.12)";
  box.style.color = "#0f172a";
  box.style.fontFamily = "Inter, \"Segoe UI\", sans-serif";
  box.style.lineHeight = "1.55";

  const title = document.createElement("div");
  title.textContent = "KNOWLENSE";
  title.style.fontSize = "12px";
  title.style.fontWeight = "700";
  title.style.letterSpacing = "0.08em";
  title.style.color = "#374151";
  title.style.marginBottom = "10px";

  const summary = document.createElement("div");
  summary.textContent = formatSummary(summaryText);
  summary.style.fontSize = "13px";
  summary.style.color = "#111827";
  summary.style.maxHeight = "300px";
  summary.style.overflowY = "auto";
  summary.style.marginBottom = "12px";

  const source = sourceUrl ? document.createElement("a") : document.createElement("span");
  source.textContent = sourceUrl ? "Source" : "No source available";
  source.style.fontSize = "12px";
  source.style.fontWeight = "600";
  source.style.color = sourceUrl ? "#2563eb" : "#6b7280";
  source.style.textDecoration = "none";

  if (sourceUrl) {
    source.href = sourceUrl;
    source.target = "_blank";
    source.rel = "noreferrer noopener";
  }

  box.append(title, summary, source);
  document.body.appendChild(box);

  const { width, height } = box.getBoundingClientRect();
  const { left, top } = getSafePosition(pointerX, pointerY, width, height);
  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
}

function createLookupIcon(pointerX, pointerY) {
  removeLookupIcon();

  const button = document.createElement("button");
  button.id = LOOKUP_ICON_ID;
  button.type = "button";
  button.textContent = "K";
  button.setAttribute("aria-label", "Look up with Knowlense");
  button.style.position = "fixed";
  button.style.left = `${pointerX + 8}px`;
  button.style.top = `${pointerY + 8}px`;
  button.style.zIndex = "2147483647";
  button.style.width = "28px";
  button.style.height = "28px";
  button.style.border = "0";
  button.style.borderRadius = "999px";
  button.style.background = "#0891b2";
  button.style.boxShadow = "0 10px 24px rgba(8, 145, 178, 0.35)";
  button.style.color = "#ffffff";
  button.style.fontFamily = "Inter, \"Segoe UI\", sans-serif";
  button.style.fontSize = "13px";
  button.style.fontWeight = "700";

  button.addEventListener("click", () => {
    void lookupSelectedTerm();
  });

  document.body.appendChild(button);
}

async function updateSubscriptionState() {
  try {
    const api = await loadApiService();
    const result = await api.checkSubscriptionStatus();

    if (result?.ok && result?.subscription?.state) {
      subscriptionState = result.subscription.state;
      return;
    }
  } catch (error) {
    console.error("Failed to load subscription state:", error);
  }

  subscriptionState = "free";
}

async function lookupSelectedTerm() {
  if (!currentSelection) {
    return;
  }

  removeLookupIcon();
  createFloatingBox(latestPointer.x, latestPointer.y, "Loading definition...", "");

  try {
    const api = await loadApiService();
    const result = await api.getTermDefinition(currentSelection);

    if (!result?.ok) {
      createFloatingBox(latestPointer.x, latestPointer.y, result?.error || "Unable to load definition.", "");
      return;
    }

    createFloatingBox(
      latestPointer.x,
      latestPointer.y,
      result.summary || result.extract || "No summary available.",
      result.source || result.sourceUrl || ""
    );
  } catch (error) {
    createFloatingBox(
      latestPointer.x,
      latestPointer.y,
      error instanceof Error ? error.message : "Unable to load definition.",
      ""
    );
  }
}

function handleSelection(event) {
  currentSelection = window.getSelection()?.toString().trim() || "";
  latestPointer = { x: event.clientX, y: event.clientY };

  if (!currentSelection) {
    removeLookupIcon();
    removeFloatingBox();
    return;
  }

  console.log("Knowlense selected text:", currentSelection);
  createLookupIcon(event.clientX, event.clientY);

  if (subscriptionState === "premium" || subscriptionState === "trial") {
    void lookupSelectedTerm();
  }
}

document.addEventListener("mouseup", (event) => {
  window.setTimeout(() => {
    handleSelection(event);
  }, 0);
});

document.addEventListener("mousedown", (event) => {
  const box = document.getElementById(FLOATING_BOX_ID);
  const icon = document.getElementById(LOOKUP_ICON_ID);

  if (box && !box.contains(event.target)) {
    removeFloatingBox();
  }

  if (icon && !icon.contains(event.target)) {
    removeLookupIcon();
  }
});

window.addEventListener("resize", () => {
  removeLookupIcon();
  removeFloatingBox();
});

window.addEventListener("scroll", () => {
  removeLookupIcon();
  removeFloatingBox();
}, true);

void updateSubscriptionState();

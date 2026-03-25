const FLOATING_BOX_ID = "knowlense-floating-box";

function removeFloatingBox() {
  const existingBox = document.getElementById(FLOATING_BOX_ID);
  if (existingBox) {
    existingBox.remove();
  }
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

function createFloatingBox(pointerX, pointerY, summaryText, sourceUrl, keyword) {
  removeFloatingBox();

  const box = document.createElement("div");
  box.id = FLOATING_BOX_ID;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", `Knowlense summary for ${keyword}`);
  box.style.position = "fixed";
  box.style.zIndex = "2147483647";
  box.style.width = "320px";
  box.style.maxWidth = "calc(100vw - 28px)";
  box.style.padding = "14px 16px";
  box.style.borderRadius = "16px";
  box.style.border = "1px solid rgba(148, 163, 184, 0.28)";
  box.style.background = "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))";
  box.style.boxShadow = "0 18px 45px rgba(15, 23, 42, 0.18)";
  box.style.backdropFilter = "blur(10px)";
  box.style.color = "#0f172a";
  box.style.fontFamily = "\"Segoe UI\", \"Helvetica Neue\", Arial, sans-serif";
  box.style.lineHeight = "1.5";

  const title = document.createElement("div");
  title.textContent = "Knowlense";
  title.style.fontSize = "12px";
  title.style.fontWeight = "700";
  title.style.letterSpacing = "0.08em";
  title.style.textTransform = "uppercase";
  title.style.color = "#475569";
  title.style.marginBottom = "8px";

  const summary = document.createElement("div");
  summary.textContent = summaryText;
  summary.style.fontSize = "13px";
  summary.style.marginBottom = "10px";
  summary.style.maxHeight = "180px";
  summary.style.overflowY = "auto";

  const source = sourceUrl ? document.createElement("a") : document.createElement("span");
  source.textContent = sourceUrl ? "Source" : "No source available";
  source.style.display = "inline-flex";
  source.style.alignItems = "center";
  source.style.gap = "6px";
  source.style.fontSize = "12px";
  source.style.fontWeight = "600";
  source.style.color = sourceUrl ? "#2563eb" : "#64748b";
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

  return box;
}

function showLoadingBox(pointerX, pointerY) {
  return createFloatingBox(pointerX, pointerY, "Fetching summary from Wikipedia...", "", "selection");
}

function fetchSummaryFromBackground(keyword) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "FETCH_WIKIPEDIA_SUMMARY",
        keyword
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response?.ok) {
          reject(new Error(response?.error || "Failed to fetch summary."));
          return;
        }

        resolve(response.data);
      }
    );
  });
}

async function handleSelection(event) {
  const selectedText = window.getSelection()?.toString().trim();

  if (!selectedText) {
    removeFloatingBox();
    return;
  }

  console.log("Knowlense selected text:", selectedText);
  showLoadingBox(event.clientX, event.clientY);

  try {
    const result = await fetchSummaryFromBackground(selectedText);
    createFloatingBox(event.clientX, event.clientY, result.extract, result.source, selectedText);
  } catch (error) {
    createFloatingBox(
      event.clientX,
      event.clientY,
      error.message || "No summary found for the selected text.",
      `https://en.wikipedia.org/wiki/${encodeURIComponent(selectedText)}`,
      selectedText
    );
  }
}

document.addEventListener("mouseup", (event) => {
  window.setTimeout(() => {
    handleSelection(event);
  }, 0);
});

document.addEventListener("mousedown", (event) => {
  const box = document.getElementById(FLOATING_BOX_ID);
  if (box && !box.contains(event.target)) {
    removeFloatingBox();
  }
});

window.addEventListener("resize", removeFloatingBox);
window.addEventListener("scroll", removeFloatingBox, true);

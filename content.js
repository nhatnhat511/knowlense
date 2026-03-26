const FLOATING_BOX_ID = "knowlense-floating-box";
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

let latestPointer = { x: 0, y: 0 };
let currentSelection = "";

function isExcludedPage() {
  return EXCLUDED_HOST_PATTERNS.some((pattern) => pattern.test(window.location.hostname));
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
  return String(text || "").replace(/\s+/g, " ").trim();
}

function getTextNodeContent(node) {
  if (!node) {
    return "";
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }

  if (node instanceof Element) {
    return node.textContent || "";
  }

  return "";
}

function getClosestBlockElement(node) {
  const element = node instanceof Element ? node : node?.parentElement;
  return element?.closest("p, li, blockquote, article, section, div") || element || null;
}

function extractSentenceFromText(text, selectedText) {
  const normalizedText = formatSummary(text);
  const normalizedSelection = formatSummary(selectedText);

  if (!normalizedText) {
    return "";
  }

  if (!normalizedSelection) {
    return normalizedText.slice(0, 260);
  }

  const index = normalizedText.toLowerCase().indexOf(normalizedSelection.toLowerCase());
  if (index === -1) {
    return normalizedText.slice(0, 260);
  }

  const before = normalizedText.slice(0, index);
  const after = normalizedText.slice(index + normalizedSelection.length);
  const sentenceStart = Math.max(before.lastIndexOf("."), before.lastIndexOf("!"), before.lastIndexOf("?"));
  const nearestEndOffsets = [after.indexOf("."), after.indexOf("!"), after.indexOf("?")].filter((value) => value >= 0);
  const sentenceEnd = nearestEndOffsets.length > 0 ? Math.min(...nearestEndOffsets) : after.length - 1;

  return normalizedText
    .slice(Math.max(0, sentenceStart + 1), index + normalizedSelection.length + sentenceEnd + 1)
    .trim();
}

function getNearestHeadingText(node) {
  const element = node instanceof Element ? node : node?.parentElement;
  if (!element) {
    return "";
  }

  const directHeading = element.closest("h1, h2, h3, h4, h5, h6");
  if (directHeading) {
    return formatSummary(directHeading.textContent || "");
  }

  const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  let bestHeading = "";

  for (const heading of headings) {
    const position = heading.compareDocumentPosition(element);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
      bestHeading = formatSummary(heading.textContent || "");
    }
  }

  return bestHeading;
}

function getMetaDescription() {
  return formatSummary(
    document.querySelector('meta[name="description"]')?.getAttribute("content") ||
      document.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
      ""
  );
}

function isWordCharacter(value) {
  return /[\p{L}\p{N}_'-]/u.test(value || "");
}

function getSelectionScopeNode(range) {
  if (!range) {
    return document.body;
  }

  const commonNode =
    range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer?.parentElement;

  return getClosestBlockElement(commonNode) || commonNode || document.body;
}

function getTrailingWordFragment(text) {
  if (!text) {
    return "";
  }

  let fragment = "";
  for (let index = text.length - 1; index >= 0; index -= 1) {
    const character = text[index];
    if (!isWordCharacter(character)) {
      break;
    }
    fragment = `${character}${fragment}`;
  }

  return fragment;
}

function getLeadingWordFragment(text) {
  if (!text) {
    return "";
  }

  let fragment = "";
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (!isWordCharacter(character)) {
      break;
    }
    fragment += character;
  }

  return fragment;
}

function getRangeTextWithinScope(scopeNode, boundaryContainer, boundaryOffset, direction) {
  if (!scopeNode || !boundaryContainer) {
    return "";
  }

  try {
    const helperRange = document.createRange();
    helperRange.selectNodeContents(scopeNode);

    if (direction === "backward") {
      helperRange.setEnd(boundaryContainer, boundaryOffset);
    } else {
      helperRange.setStart(boundaryContainer, boundaryOffset);
    }

    return helperRange.toString();
  } catch {
    return "";
  }
}

function getCompleteSelectionBoundaryTokens(selection) {
  if (!selection || selection.rangeCount === 0) {
    return { startToken: "", endToken: "" };
  }

  const range = selection.getRangeAt(0);
  const scopeNode = getSelectionScopeNode(range);
  const selectedText = selection.toString();
  const prefixText = getRangeTextWithinScope(scopeNode, range.startContainer, range.startOffset, "backward");
  const suffixText = getRangeTextWithinScope(scopeNode, range.endContainer, range.endOffset, "forward");
  const startToken = `${getTrailingWordFragment(prefixText)}${selectedText.split(/\s+/)[0] || ""}`;
  const selectedWords = selectedText.trim().split(/\s+/).filter(Boolean);
  const lastSelectedWord = selectedWords[selectedWords.length - 1] || "";
  const endToken = `${lastSelectedWord}${getLeadingWordFragment(suffixText)}`;

  return {
    startToken: formatSummary(startToken),
    endToken: formatSummary(endToken)
  };
}

function isPartialWordSelection(selection, selectedText) {
  if (!selection || selection.rangeCount === 0 || !selectedText) {
    return false;
  }

  const normalizedSelection = formatSummary(selectedText);
  const selectionWords = normalizedSelection.split(/\s+/).filter(Boolean);
  if (selectionWords.length === 0) {
    return false;
  }

  const { startToken, endToken } = getCompleteSelectionBoundaryTokens(selection);
  const firstSelectedWord = selectionWords[0] || "";
  const lastSelectedWord = selectionWords[selectionWords.length - 1] || "";

  const partialAtStart =
    isWordCharacter(firstSelectedWord[0] || "") &&
    Boolean(startToken) &&
    startToken.toLowerCase() !== firstSelectedWord.toLowerCase();
  const partialAtEnd =
    isWordCharacter(lastSelectedWord[lastSelectedWord.length - 1] || "") &&
    Boolean(endToken) &&
    endToken.toLowerCase() !== lastSelectedWord.toLowerCase();

  return partialAtStart || partialAtEnd;
}

function getSelectionContext() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return {
      sentence: "",
      paragraph: "",
      heading: "",
      pageTitle: document.title || "",
      metaDescription: getMetaDescription(),
      hostname: window.location.hostname || "",
      partialWordSelection: false
    };
  }

  const anchorNode = selection.anchorNode;
  const blockElement = getClosestBlockElement(anchorNode);
  const paragraphText = formatSummary(getTextNodeContent(blockElement)).slice(0, 700);
  const sentenceText = extractSentenceFromText(paragraphText, currentSelection).slice(0, 320);
  const headingText = getNearestHeadingText(blockElement);

  return {
    sentence: sentenceText,
    paragraph: paragraphText,
    heading: headingText,
    pageTitle: formatSummary(document.title || ""),
    metaDescription: getMetaDescription(),
    hostname: window.location.hostname || "",
    partialWordSelection: isPartialWordSelection(selection, currentSelection)
  };
}

function ensurePopoverStyles() {
  if (document.getElementById("knowlense-popover-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "knowlense-popover-style";
  style.textContent = `
    .knowlense-spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(8, 145, 178, 0.18);
      border-top-color: #0891b2;
      border-radius: 999px;
      animation: knowlense-spin 0.8s linear infinite;
    }

    @keyframes knowlense-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;

  document.documentElement.appendChild(style);
}

function createFloatingBox(pointerX, pointerY, options) {
  removeFloatingBox();
  ensurePopoverStyles();

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
  summary.style.fontSize = "13px";
  summary.style.color = "#111827";
  summary.style.maxHeight = "300px";
  summary.style.overflowY = "auto";
  summary.style.marginBottom = "16px";
  summary.style.textAlign = "left";
  summary.style.wordBreak = "normal";
  summary.style.overflowWrap = "break-word";
  summary.style.hyphens = "manual";
  summary.style.lineHeight = "1.65";
  summary.style.letterSpacing = "0";

  if (options.state === "loading") {
    const loadingWrap = document.createElement("div");
    loadingWrap.style.display = "flex";
    loadingWrap.style.alignItems = "center";
    loadingWrap.style.gap = "10px";

    const spinner = document.createElement("div");
    spinner.className = "knowlense-spinner";

    const text = document.createElement("span");
    text.textContent = "Looking up the term...";
    text.style.color = "#475569";

    loadingWrap.append(spinner, text);
    summary.appendChild(loadingWrap);
  } else {
    summary.textContent = formatSummary(options.summary || "No definition found");

    if (options.state === "empty") {
      summary.style.color = "#64748b";
    }
  }

  const hasValidSource = isValidSourceUrl(options.source);
  const source = hasValidSource ? document.createElement("a") : document.createElement("span");
  source.textContent = hasValidSource ? "Source" : options.state === "empty" ? "Try another term" : "Wikipedia source unavailable";
  source.style.fontSize = "12px";
  source.style.fontWeight = "600";
  source.style.color = hasValidSource ? "#2563eb" : "#6b7280";
  source.style.textDecoration = "none";

  if (hasValidSource) {
    source.href = options.source;
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

async function lookupSelectedTerm() {
  if (!currentSelection) {
    return;
  }

  const context = getSelectionContext();

  if (context.partialWordSelection) {
    createFloatingBox(latestPointer.x, latestPointer.y, {
      state: "empty",
      summary: "No information found for this term.",
      source: ""
    });
    return;
  }

  createFloatingBox(latestPointer.x, latestPointer.y, {
    state: "loading"
  });

  chrome.runtime.sendMessage(
    {
      type: "ANALYZE_SELECTED_TERM",
      keyword: currentSelection,
      context
    },
    (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        createFloatingBox(latestPointer.x, latestPointer.y, {
          state: "empty",
          summary: "No information found for this term.",
          source: ""
        });
        return;
      }

      if (response.data?.type !== "entity" || !response.data?.extract) {
        createFloatingBox(latestPointer.x, latestPointer.y, {
          state: "empty",
          summary: response.data?.extract || "No information found for this term.",
          source: ""
        });
        return;
      }

      createFloatingBox(latestPointer.x, latestPointer.y, {
        state: "success",
        summary: response.data.extract,
        source: response.data?.source || ""
      });
    }
  );
}

function handleSelection(event) {
  if (isExcludedPage()) {
    return;
  }

  if (event.target instanceof Element && event.target.closest(`#${FLOATING_BOX_ID}`)) {
    return;
  }

  currentSelection = window.getSelection()?.toString().trim() || "";
  latestPointer = { x: event.clientX, y: event.clientY };

  if (!currentSelection) {
    removeFloatingBox();
    return;
  }

  void lookupSelectedTerm();
}

document.addEventListener("mouseup", (event) => {
  window.setTimeout(() => {
    handleSelection(event);
  }, 0);
});

document.addEventListener("mousedown", (event) => {
  const box = document.getElementById(FLOATING_BOX_ID);

  if (box && event.target instanceof Node && !box.contains(event.target)) {
    removeFloatingBox();
  }
});

window.addEventListener("resize", () => {
  removeFloatingBox();
});

window.addEventListener(
  "scroll",
  () => {
    removeFloatingBox();
  },
  true
);

function isValidSourceUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    return false;
  }
}

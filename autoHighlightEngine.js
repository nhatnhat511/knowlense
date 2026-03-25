(function runKnowlenseAutoHighlight() {
  const STYLE_ID = "knowlense-auto-highlight-style";
  const MARK_CLASS = "knowlense-auto-highlight";
  const STOP_WORDS = new Set([
    "about",
    "after",
    "before",
    "being",
    "browser",
    "chrome",
    "could",
    "extension",
    "first",
    "found",
    "highlight",
    "however",
    "knowlense",
    "other",
    "their",
    "there",
    "these",
    "those",
    "through",
    "using",
    "which",
    "without"
  ]);

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${MARK_CLASS} {
        background: linear-gradient(180deg, rgba(8, 145, 178, 0.05) 0%, rgba(8, 145, 178, 0.22) 100%);
        border-radius: 4px;
        padding: 0 2px;
        box-shadow: inset 0 -1px 0 rgba(8, 145, 178, 0.18);
      }
    `;

    document.documentElement.appendChild(style);
  }

  function clearHighlights() {
    document.querySelectorAll(`mark.${MARK_CLASS}`).forEach((mark) => {
      const parent = mark.parentNode;

      if (!parent) {
        return;
      }

      parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
      parent.normalize();
    });
  }

  function extractImportantKeywords() {
    const paragraphs = Array.from(document.querySelectorAll("p"));
    const counts = new Map();

    for (const paragraph of paragraphs) {
      const words = paragraph.textContent?.match(/[A-Za-z][A-Za-z-]{5,}/g) || [];

      for (const word of words) {
        const normalized = word.toLowerCase();

        if (STOP_WORDS.has(normalized)) {
          continue;
        }

        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }
    }

    return [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);
  }

  function replaceMatchesInTextNode(textNode, regex) {
    const text = textNode.nodeValue || "";
    const match = regex.exec(text);

    if (!match) {
      return false;
    }

    const matchedText = match[0];
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + matchedText.length);
    const mark = document.createElement("mark");
    mark.className = MARK_CLASS;
    mark.textContent = matchedText;

    const fragment = document.createDocumentFragment();

    if (before) {
      fragment.appendChild(document.createTextNode(before));
    }

    fragment.appendChild(mark);

    if (after) {
      fragment.appendChild(document.createTextNode(after));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
    return true;
  }

  function highlightKeywordInParagraph(paragraph, keyword, budget) {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();

    while (textNode && budget.count < budget.max) {
      const parentElement = textNode.parentElement;

      if (parentElement && !parentElement.closest(`mark.${MARK_CLASS}`)) {
        if (replaceMatchesInTextNode(textNode, regex)) {
          budget.count += 1;
          return;
        }
      }

      textNode = walker.nextNode();
    }
  }

  ensureStyle();
  clearHighlights();

  const keywords = extractImportantKeywords();
  if (!keywords.length) {
    return;
  }

  const paragraphs = Array.from(document.querySelectorAll("p"));
  const budget = { count: 0, max: 24 };

  for (const paragraph of paragraphs) {
    for (const keyword of keywords) {
      if (budget.count >= budget.max) {
        return;
      }

      highlightKeywordInParagraph(paragraph, keyword, budget);
    }
  }
})();

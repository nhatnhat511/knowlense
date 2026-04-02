const PANEL_ID = "knowlense-product-panel";
const STYLE_ID = "knowlense-product-panel-style";
const BUBBLE_ID = "knowlense-product-bubble";

const PANEL_STATE = {
  mountedUrl: null,
  bubble: null,
  panel: null,
  healthAction: null,
  healthStatus: null,
  healthResults: null,
  rewriteShell: null,
  rewriteAction: null,
  rewriteStatus: null,
  rewriteResults: null,
  rewriteKeywordInput: null,
  productMetaValue: null
};

function syncPanelVisibility(isOpen) {
  if (!PANEL_STATE.panel || !PANEL_STATE.bubble) {
    return;
  }

  PANEL_STATE.panel.hidden = !isOpen;
  PANEL_STATE.bubble.setAttribute("aria-expanded", isOpen ? "true" : "false");
  PANEL_STATE.bubble.setAttribute("aria-label", isOpen ? "Close Knowlense SEO Health" : "Open Knowlense SEO Health");
  PANEL_STATE.bubble.classList.toggle("is-open", isOpen);
}

function textFromNode(node) {
  return node?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function textFromRoot(root = document) {
  return root?.body?.innerText?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeText(value) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeProductUrl(value) {
  try {
    const url = new URL(value, window.location.origin);
    return `${url.origin}${url.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, "").toLowerCase();
  }
}

function cleanGradeText(value) {
  return value
    .replace(/\bMostly used with\b.*$/i, "")
    .replace(/\bGrades?\b/i, "")
    .trim();
}

function splitList(value, kind = "default") {
  const source = kind === "grades" ? cleanGradeText(value) : value;
  return source
    .split(/,|\/|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isProductPage() {
  return /teacherspayteachers\.com\/Product\//.test(window.location.href);
}

function extractSearchQuery() {
  const url = new URL(window.location.href);
  const directQuery =
    url.searchParams.get("q") ||
    url.searchParams.get("search") ||
    url.searchParams.get("query") ||
    document.querySelector("input[type='search']")?.value ||
    document.querySelector("input[name='search']")?.value;

  return (directQuery || "").trim();
}

function extractResults() {
  const productLinks = [...document.querySelectorAll("a[href*='/Product/']")];
  const seen = new Set();

  return productLinks
    .map((link, index) => {
      const href = link.href;
      if (!href || seen.has(href)) {
        return null;
      }

      seen.add(href);

      const container =
        link.closest("article, li, [data-resource-id], [data-product-id], .SearchResultsPage__result, .product-list-item") ||
        link.parentElement;

      if (!container) {
        return null;
      }

      const title = textFromNode(link);
      if (!title) {
        return null;
      }

      const containerText = textFromNode(container);
      const lines = containerText
        .split(/\s{2,}|\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const snippet = lines.find((line) => line !== title && line.length > 24) || "";
      const priceText = containerText.match(/\$\d+(?:\.\d{2})?/)?.[0] || "";

      const shopLink = [...container.querySelectorAll("a")]
        .map((anchor) => textFromNode(anchor))
        .find((value) => value && value !== title && !value.includes("$"));

      return {
        position: index + 1,
        title,
        productUrl: href,
        shopName: shopLink || "",
        priceText,
        snippet
      };
    })
    .filter(Boolean)
    .slice(0, 18);
}

function extractSearchSnapshot() {
  const query = extractSearchQuery();
  const results = extractResults();

  if (!query) {
    return {
      ok: false,
      error: "No search query was detected on this page."
    };
  }

  if (results.length === 0) {
    return {
      ok: false,
      error: "No TPT product results were detected on this page."
    };
  }

  return {
    ok: true,
    snapshot: {
      query,
      pageUrl: window.location.href,
      capturedAt: new Date().toISOString(),
      results
    }
  };
}

function extractProductMeta() {
  const title = textFromNode(document.querySelector("h1")) || "Current product";

  return {
    title
  };
}

function extractResourceSpecsMap(root = document) {
  const specs = new Map();
  const labelNodes = [...root.querySelectorAll("span[class*='ResourceSpecs-module__detailLabel']")];

  labelNodes.forEach((labelNode) => {
    const label = normalizeText(textFromNode(labelNode)).replace(/:$/, "").trim();
    if (!label || specs.has(label)) {
      return;
    }

    const row =
      labelNode.closest("div[class*='Box--display-flex']") ||
      labelNode.closest("div[class*='ResourceSpecs']") ||
      labelNode.parentElement;

    if (!row) {
      return;
    }

    const detailRoot =
      row.querySelector("div[class*='Text-module__detail']") ||
      row.querySelector("div[class*='Text-module__root']") ||
      row;

    const inlineValues = [...detailRoot.querySelectorAll("div, span, p")]
      .filter((node) => {
        if (node === labelNode || labelNode.contains(node)) {
          return false;
        }

        const className = node.getAttribute("class") || "";
        return /Text-module__(inline|detail)/i.test(className);
      })
      .map((node) => textFromNode(node))
      .filter(Boolean)
      .filter((text) => normalizeText(text) !== label);

    const anchorValues = [...detailRoot.querySelectorAll("a")]
      .map((anchor) => textFromNode(anchor))
      .filter(Boolean);

    let valueText = "";
    if (label === "grades") {
      valueText = textFromNode(detailRoot)
        .replace(textFromNode(labelNode), "")
        .replace(/\bMostly used with\b.*$/i, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    } else if (label === "pages") {
      valueText = textFromNode(detailRoot)
        .replace(textFromNode(labelNode), "")
        .replace(/\s{2,}/g, " ")
        .trim();
    } else if (anchorValues.length > 0) {
      valueText = anchorValues.join(", ");
    } else if (inlineValues.length > 0) {
      valueText = inlineValues.join(" ");
    } else {
      const rowText = textFromNode(row);
      const labelText = textFromNode(labelNode);
      valueText = rowText
        .replace(labelText, "")
        .replace(/^\s*[:,\-]\s*/, "")
        .trim();
    }

    if (valueText) {
      specs.set(
        label,
        valueText
          .replace(/\s*,\s*/g, ", ")
          .replace(/\s{2,}/g, " ")
          .trim()
      );
    }
  });

  return specs;
}

function findLabelValue(label, root = document) {
  const specs = extractResourceSpecsMap(root);
  return specs.get(normalizeText(label)) || "";
}

function findHighlightsRow(label, root = document) {
  const normalizedLabel = normalizeText(label);
  const labelNode = [...root.querySelectorAll("span[class*='ResourceSpecs-module__detailLabel']")].find(
    (node) => normalizeText(textFromNode(node)).replace(/:$/, "").trim() === normalizedLabel
  );

  if (!labelNode) {
    return null;
  }

  return (
    labelNode.closest("div[class*='Box--display-flex']") ||
    labelNode.closest("div[class*='ResourceSpecs']") ||
    labelNode.parentElement
  );
}

function extractFieldFromHighlights(label, root = document) {
  const row = findHighlightsRow(label, root);
  if (!row) {
    return "";
  }

  const detailRoot =
    row.querySelector("div[class*='Text-module__detail']") ||
    row.querySelector("div[class*='Text-module__root']") ||
    row;

  if (normalizeText(label) === "grades") {
    const inlineNode = detailRoot.querySelector("div[class*='Text-module__inline']");
    return cleanGradeText(textFromNode(inlineNode || detailRoot));
  }

  if (normalizeText(label) === "pages") {
    const inlineNode = detailRoot.querySelector("div[class*='Text-module__inline']");
    return textFromNode(inlineNode || detailRoot).replace(textFromNode(row.querySelector("span[class*='ResourceSpecs-module__detailLabel']") || null), "").trim();
  }

  const anchors = [...detailRoot.querySelectorAll("a")]
    .map((anchor) => textFromNode(anchor))
    .filter(Boolean);

  if (anchors.length > 0) {
    return anchors.join(", ");
  }

  return textFromNode(detailRoot)
    .replace(textFromNode(row.querySelector("span[class*='ResourceSpecs-module__detailLabel']") || null), "")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

function getDescriptionBodyNode(root = document) {
  const descriptionRoot = root.querySelector("#description");
  if (!descriptionRoot) {
    return null;
  }

  return (
    descriptionRoot.querySelector(
      ".DescriptionLayout__htmlDisplay.DescriptionLayout__htmlDisplay--fromNewEditor"
    ) || descriptionRoot.querySelector(".DescriptionLayout__htmlDisplay")
  );
}

function extractDescriptionFieldData(root = document) {
  const body = getDescriptionBodyNode(root);
  if (!body) {
    return {
      text: "",
      wordCount: 0,
      productLinks: [],
      allLinks: []
    };
  }

  const clone = body.cloneNode(true);
  clone.querySelectorAll("script, style, noscript").forEach((node) => node.remove());

  const renderedText = (body.innerText || "").trim();
  const clonedText = (clone.innerText || clone.textContent || "").trim();
  const text = (renderedText || clonedText)
    .replace(/\s+/g, " ")
    .trim();

  const allLinks = [...clone.querySelectorAll("a[href]")]
    .map((anchor) => {
      const href = anchor.getAttribute("href");
      if (!href) {
        return null;
      }
      try {
        return new URL(href, window.location.origin).href;
      } catch {
        return href;
      }
    })
    .filter(Boolean);

  const productLinks = allLinks.filter((href) => /teacherspayteachers\.com\/Product\//i.test(href));

  return {
    text,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    productLinks,
    allLinks
  };
}

function extractDescriptionText(root = document) {
  return extractDescriptionFieldData(root).text;
}

function extractDescriptionExcerpt(root = document) {
  const descriptionText = extractDescriptionFieldData(root).text;
  if (!descriptionText) {
    return "";
  }

  return descriptionText.slice(0, 300).trim();
}

function extractDescriptionWordCount(root = document) {
  return extractDescriptionFieldData(root).wordCount;
}

function extractSellerName(root = document) {
  const sellerLink =
    root.querySelector(
      "[class*='AboutAuthorRow-module__aboutAuthorRow'] [class*='AboutAuthorRow-module__detailsContainer'] a[class*='AboutAuthorRow-module__authorLink'][href^='/store/']"
    ) ||
    root.querySelector(
      "[class*='AboutAuthorRow-module__aboutAuthorRow'] a[class*='AboutAuthorRow-module__authorAvatarLink'][href^='/store/']"
    ) ||
    root.querySelector(
      "[class*='AboutAuthorRow-module__aboutAuthorRow'] [class*='AboutAuthorRow-module__detailsContainer'] a[href^='/store/']"
    ) ||
    [...root.querySelectorAll("a")].find(
      (anchor) => /\/store\//i.test(anchor.href || "") || /followers?/i.test(textFromNode(anchor.parentElement || null))
    );

  return textFromNode(sellerLink) || "";
}

function extractSellerStorePath(root = document) {
  const sellerLink =
    root.querySelector(
      "[class*='AboutAuthorRow-module__aboutAuthorRow'] [class*='AboutAuthorRow-module__detailsContainer'] a[class*='AboutAuthorRow-module__authorLink'][href^='/store/']"
    ) ||
    root.querySelector(
      "[class*='AboutAuthorRow-module__aboutAuthorRow'] a[class*='AboutAuthorRow-module__authorAvatarLink'][href^='/store/']"
    ) ||
    root.querySelector(
      "[class*='AboutAuthorRow-module__aboutAuthorRow'] [class*='AboutAuthorRow-module__detailsContainer'] a[href^='/store/']"
    );

  const href = sellerLink?.getAttribute("href") || "";
  if (!href) {
    return null;
  }

  try {
    const url = new URL(href, window.location.origin);
    const match = url.pathname.match(/^\/store\/[^/?#]+/i);
    return match ? match[0].toLowerCase() : null;
  } catch {
    const match = href.match(/^\/store\/[^/?#]+/i);
    return match ? match[0].toLowerCase() : null;
  }
}

function normalizeStorePath(value) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value, window.location.origin);
    const match = url.pathname.match(/^\/store\/[^/?#]+/i);
    return match ? match[0].toLowerCase() : "";
  } catch {
    const match = String(value).match(/^\/store\/[^/?#]+/i);
    return match ? match[0].toLowerCase() : "";
  }
}

function extractMediaData(root = document) {
  const galleryRoot =
    root.querySelector("[class*='ProductPageLayout_mainLeft']") ||
    root.querySelector("[class*='ProductPageLayout__mainLeft']") ||
    root.querySelector("main");
  const thumbnailNodes = [...(galleryRoot || root).querySelectorAll("[data-testid]")]
    .filter((node) => /^thumbnail-\d+$/i.test(node.getAttribute("data-testid") || ""));
  const imageCount = thumbnailNodes.length > 0
    ? thumbnailNodes.length
    : [...(galleryRoot || root).querySelectorAll("img")]
        .filter((image) => {
          const src = image.getAttribute("src") || "";
          const alt = image.getAttribute("alt") || "";
          return /product|preview|thumbnail|page/i.test(src) || /preview|product/i.test(alt);
        })
        .slice(0, 12).length;
  const hasVideo = Boolean(
    (galleryRoot || root).querySelector(
      "[class*='videoDurationOverlay'], [class*='videoDurationText'], [class*='videoPlayIcon'], [data-testid^='thumbnail-'] [class*='video']"
    )
  );
  const hasReviewSection = Boolean(
    root.querySelector("a[href='#ratings-and-reviews']") ||
      root.querySelector("#ratings-and-reviews") ||
      root.querySelector(".EvaluationsSummary-module__container, [class*='EvaluationsSummary-module__container']")
  );

  return {
    imageCount,
    hasVideo,
    hasReviewSection
  };
}

function extractHasPreview(root = document) {
  const galleryRoot =
    root.querySelector("[class*='ProductPageLayout_mainLeft']") ||
    root.querySelector("[class*='ProductPageLayout__mainLeft']") ||
    root.querySelector("main");

  return Boolean(
    (galleryRoot || root).querySelector(
      "[class*='previewButton'] button, [class*='previewButton'][type='button'], [data-testid='preview-images-container'] button"
    ) || [...(galleryRoot || root).querySelectorAll("button")]
      .some((node) => /^view preview$/i.test(textFromNode(node)))
  );
}

function extractDescriptionProductLinks(root = document) {
  return extractDescriptionFieldData(root).allLinks;
}

async function resolveDescriptionLinkDetails(links) {
  const uniqueLinks = [...new Set((links || []).filter(Boolean))];

  const resolved = await Promise.all(
    uniqueLinks.map(async (link) => {
      const normalizedLink = String(link);
      const storePath = normalizeStorePath(normalizedLink);
      if (storePath) {
        return {
          url: normalizedLink,
          type: "store",
          resolvedStorePath: storePath
        };
      }

      if (!/teacherspayteachers\.com\/Product\//i.test(normalizedLink)) {
        return {
          url: normalizedLink,
          type: "external",
          resolvedStorePath: null
        };
      }

      try {
        const response = await fetch(normalizedLink, {
          credentials: "include"
        });
        if (!response.ok) {
          throw new Error("Linked product fetch failed.");
        }

        const html = await response.text();
        const linkedDocument = new DOMParser().parseFromString(html, "text/html");
        const resolvedStorePath = extractSellerStorePath(linkedDocument);

        return {
          url: normalizedLink,
          type: "product",
          resolvedStorePath: normalizeStorePath(resolvedStorePath)
        };
      } catch {
        return {
          url: normalizedLink,
          type: "product",
          resolvedStorePath: null
        };
      }
    })
  );

  return resolved;
}

function extractReviewData(root = document) {
  const reviewsTab =
    root.querySelector("a[href='#ratings-and-reviews']") ||
    root.querySelector("[href='#ratings-and-reviews']");
  const reviewsTabText = textFromNode(reviewsTab);
  const hoverLabel =
    root.querySelector(".EvaluationHoverPopoverLabel, [class*='EvaluationHoverPopoverLabel']") ||
    root.querySelector("[data-testid='EvaluationPopover'] [class*='EvaluationHoverPopoverLabel']");
  const summaryNode =
    root.querySelector(".EvaluationHoverSummary, [class*='EvaluationHoverSummary'], [data-testid='HoverAnalyticsContainer']") ||
    root.querySelector(".EvaluationsSummary-module__container, [class*='EvaluationsSummary-module__container']") ||
    root.querySelector("[class*='Ratings-module__ratingsContainer'], [class*='Ratings-module_ratingsContainer']");
  const hoverText = textFromNode(hoverLabel);
  const summaryText = textFromNode(summaryNode);

  const ratingMatch =
    hoverText.match(/rated\s+(\d(?:\.\d)?)\s+out of 5,\s+based on\s+([\d,.]+[kKmM]?)\s+reviews?/i) ||
    summaryText.match(/(\d(?:\.\d)?)\s*\(([\d,.]+[kKmM]?)\s+ratings?\)/i) ||
    summaryText.match(/rated\s+(\d(?:\.\d)?)\s+out of 5,\s+based on\s+([\d,.]+[kKmM]?)\s+reviews?/i) ||
    reviewsTabText.match(/(\d(?:\.\d)?)\s*\(([\d,.]+[kKmM]?)\s+ratings?\)/i);
  const tabReviewsMatch =
    reviewsTabText.match(/\breviews?\s*([\d,.]+[kKmM]?)/i) ||
    reviewsTabText.match(/([\d,.]+[kKmM]?)\s*$/i) ||
    textFromNode(root.querySelector("a[href='#ratings-and-reviews'] sup"))?.match(/([\d,.]+[kKmM]?)/i);

  function parseCompactCount(value) {
    const normalized = String(value || "").replace(/,/g, "").trim().toLowerCase();
    if (!normalized) {
      return 0;
    }
    if (normalized.endsWith("k")) {
      return Math.round(Number.parseFloat(normalized.slice(0, -1)) * 1000);
    }
    if (normalized.endsWith("m")) {
      return Math.round(Number.parseFloat(normalized.slice(0, -1)) * 1000000);
    }
    return Number(normalized);
  }

  const average = ratingMatch ? Number(ratingMatch[1]) : null;
  const tabCount = Array.isArray(tabReviewsMatch) ? parseCompactCount(tabReviewsMatch[1]) : 0;
  const matchedCount = ratingMatch ? parseCompactCount(ratingMatch[2]) : 0;
  const count = tabCount > 0 ? tabCount : matchedCount;

  return {
    average: Number.isFinite(average) ? average : null,
    count: Number.isFinite(count) ? count : 0,
    recentDates: extractRecentReviewDates(root)
  };
}

function extractCurrentProductPrice(root = document) {
  const priceNode =
    root.querySelector("div[class*='PriceBox-module__textPrice']") ||
    root.querySelector("div[class*='PriceBox-module_textPrice']");
  const priceText = textFromNode(priceNode);
  const matchedPrice = priceText.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  const value = matchedPrice ? Number.parseFloat(matchedPrice[1]) : Number.NaN;

  return Number.isFinite(value) ? value : null;
}

function extractRecentReviewDates(root = document) {
  const reviewsRoot = root.querySelector("div#reviews-only");
  if (!reviewsRoot) {
    return [];
  }

  const listRoot =
    reviewsRoot.querySelector("div[class*='EvaluationsList-module__list']") ||
    reviewsRoot.querySelector("div[class*='EvaluationsList-module_list']");
  if (!listRoot) {
    return [];
  }

  const reviewCards = [...listRoot.children]
    .map(
      (item) =>
        item.querySelector("div[data-testid^='EvaluationDisplay-']") ||
        item.querySelector("div[class*='EvaluationDisplay-module__container']") ||
        item.querySelector("div[class*='EvaluationDisplay-module_container']")
    )
    .filter(Boolean)
    .slice(0, 5);

  return reviewCards
    .map((card) => {
      const ratingHeader =
        card.querySelector(
          "div[class*='EvaluationDisplay-module__ratingSection'] div[class*='Text-module__detail'][class*='Text-module__colorSecondary']"
        ) ||
        card.querySelector(
          "div[class*='EvaluationDisplay-module_ratingSection'] div[class*='Text-module__detail'][class*='Text-module__colorSecondary']"
        ) ||
        card.querySelector("div[class*='EvaluationDisplay-module__ratingSection'] div[class*='Text-module__detail']") ||
        card.querySelector("div[class*='EvaluationDisplay-module_ratingSection'] div[class*='Text-module__detail']");
      const dateText = textFromNode(ratingHeader);
      if (!dateText) {
        return null;
      }

      const parsed = new Date(dateText);
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }

      return parsed.toISOString();
    })
    .filter(Boolean);
}

function extractDiscountOfferDetails(root = document) {
  const discountBlocks = [...root.querySelectorAll("div[class*='DiscountCheckbox-module__discountCheckbox']")];
  let hasFirstPurchase = false;
  let hasFollower = false;

  discountBlocks.forEach((block) => {
    const textRoot = block.querySelector("[data-testid='discount-text']") || block;
    const blockText = textFromNode(textRoot);
    const normalizedBlockText = normalizeText(blockText);
    const hasFirstPurchaseCopy =
      /(?:enjoy|new users can receive)\s+\d+%\s+off(?:\s+your|\s+their)?\s+first purchase from this seller/i.test(
        normalizedBlockText
      ) || /\bfirst purchase from this seller\b/i.test(normalizedBlockText);
    const hasFollowerCopy =
      /(?:enjoy|followers? can receive)\s+\d+%\s+off(?:\s+as a thanks)?\s+for following this seller/i.test(
        normalizedBlockText
      ) || /\bfollowing this seller\b/i.test(normalizedBlockText);
    const hasApplyCopy = /check to apply\.?/i.test(normalizedBlockText);
    const hasCheckbox = Boolean(
      block.querySelector("button[role='checkbox'], input[type='checkbox'], [role='checkbox']")
    );

    if (!hasCheckbox) {
      return;
    }

    if (!hasApplyCopy && !hasFirstPurchaseCopy && !hasFollowerCopy) {
      return;
    }

    if (hasFirstPurchaseCopy) {
      hasFirstPurchase = true;
    }

    if (hasFollowerCopy) {
      hasFollower = true;
    }
  });

  return {
    visible: hasFirstPurchase || hasFollower,
    hasFirstPurchase,
    hasFollower
  };
}

function extractBundleOfferVisible(root = document) {
  const bundleBlocks = [...root.querySelectorAll("div[class*='Box--margin-top-4x']")];

  return bundleBlocks.some((block) => {
    const heading = block.querySelector("h2, h3, [role='heading'], [class*='heading']");
    const headingText = textFromNode(heading);
    if (!/save even more with bundles/i.test(headingText)) {
      return false;
    }

    return Boolean(
      block.querySelector("a[href*='/Product/'], [class*='SkinnyProductRowCard'], [class*='ParentBundles-module__list']")
    );
  });
}

function extractIsBundleProduct(root = document) {
  const bundleHeading =
    root.querySelector("#bundle-previews h3[class*='Text-module__headingXS']") ||
    root.querySelector("#bundle-previews h3");

  return /^products in this bundle\b/i.test(textFromNode(bundleHeading));
}

async function fetchProductPageDocument() {
  const response = await fetch(window.location.href, {
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Knowlense could not reload the product page for SEO Health.");
  }

  const html = await response.text();
  return new DOMParser().parseFromString(html, "text/html");
}

function extractProductId(value) {
  return value.match(/\/(\d+)(?:[/?#]|$)/)?.[1] ?? null;
}

function extractProductSnapshot(root = document) {
  const title = textFromNode(root.querySelector("h1"));
  const descriptionExcerpt = extractDescriptionExcerpt(root);
  const descriptionText = extractDescriptionText(root);
  const discountOffer = extractDiscountOfferDetails(root);
  const gradesValue = extractFieldFromHighlights("Grades", root);
  const tagsValue = extractFieldFromHighlights("Tags", root);
  const subjectsValue = extractFieldFromHighlights("Subjects", root);
  const resourceTypeValue = extractFieldFromHighlights("Resource type", root);
  const pagesValue = extractFieldFromHighlights("Pages", root);
  const currentPrice = extractCurrentProductPrice(root);

  if (!title) {
    return {
      ok: false,
      error: "Knowlense could not read the core product details on this page."
    };
  }

  return {
    ok: true,
    snapshot: {
      productId: extractProductId(window.location.href),
      productUrl: window.location.href,
      sellerName: extractSellerName(root),
      sellerStorePath: extractSellerStorePath(root),
      title,
      descriptionExcerpt,
      descriptionText,
      descriptionWordCount: extractDescriptionWordCount(root),
      grades: splitList(gradesValue, "grades"),
      tags: splitList(tagsValue),
      subjects: splitList(subjectsValue),
      resourceType: resourceTypeValue || null,
      pagesValue: pagesValue || null,
      currentPrice,
      media: extractMediaData(root),
      hasPreview: extractHasPreview(root),
      reviewData: extractReviewData(root),
      isBundleProduct: extractIsBundleProduct(root),
      discountOfferVisible: discountOffer.visible,
      discountOfferHasFirstPurchase: discountOffer.hasFirstPurchase,
      discountOfferHasFollower: discountOffer.hasFollower,
      bundleOfferVisible: extractBundleOfferVisible(root),
      descriptionProductLinks: extractDescriptionProductLinks(root)
    }
  };
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${BUBBLE_ID} {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%);
      z-index: 2147483645;
      width: 46px;
      height: 164px;
      border: 1px solid rgba(15, 23, 42, 0.1);
      border-right: 0;
      border-radius: 20px 0 0 20px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: -16px 16px 40px rgba(15, 23, 42, 0.14);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: width 160ms ease, height 160ms ease, box-shadow 160ms ease, background 160ms ease, border-radius 160ms ease;
      backdrop-filter: blur(10px);
      overflow: hidden;
    }

    #${BUBBLE_ID}:hover {
      box-shadow: -18px 18px 42px rgba(15, 23, 42, 0.18);
      background: #ffffff;
    }

    #${BUBBLE_ID}.is-open {
      width: 28px;
      height: 144px;
      border-radius: 16px 0 0 16px;
    }

    #${BUBBLE_ID} svg {
      position: absolute;
      left: 50%;
      bottom: 14px;
      width: 18px;
      height: 18px;
      margin-left: -9px;
      color: #6d5efc;
      flex: 0 0 auto;
      transition: transform 160ms ease, opacity 160ms ease, left 160ms ease, bottom 160ms ease, margin 160ms ease;
    }

    #${BUBBLE_ID} .knowlense-bubble-copy {
      position: absolute;
      left: 50%;
      top: calc(50% - 8px);
      white-space: nowrap;
      transform: translate(-50%, -50%) rotate(90deg);
      transform-origin: center;
      font-size: 13px;
      line-height: 1;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0f172a;
      transition: opacity 140ms ease;
    }

    #${BUBBLE_ID}.is-open .knowlense-bubble-copy {
      opacity: 0;
    }

    #${BUBBLE_ID}.is-open svg {
      transform: rotate(180deg);
      left: 50%;
      bottom: 50%;
      margin-left: -9px;
      margin-bottom: -9px;
    }

    #${PANEL_ID} {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 2147483644;
      width: clamp(460px, 28vw, 620px);
      height: 100vh;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-right: 0;
      border-radius: 28px 0 0 28px;
      background:
        linear-gradient(180deg, rgba(248, 250, 252, 0.98) 0%, rgba(255, 255, 255, 0.98) 24%, rgba(255, 255, 255, 0.98) 100%);
      box-shadow: -24px 0 60px rgba(15, 23, 42, 0.16);
      backdrop-filter: blur(10px);
      font-family: Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #0f172a;
      overflow: hidden;
      transform-origin: right center;
      transition: opacity 160ms ease, transform 160ms ease;
    }

    #${PANEL_ID}[hidden] {
      display: block !important;
      opacity: 0;
      transform: translateX(calc(100% - 12px));
      pointer-events: none;
      visibility: hidden;
    }

    #${PANEL_ID} * {
      box-sizing: border-box;
    }

    .knowlense-shell {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    .knowlense-header {
      padding: 26px 28px 14px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
    }

    .knowlense-badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      background: #eef2ff;
      color: #6d5efc;
      padding: 5px 9px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .knowlense-title {
      margin: 12px 0 0;
      font-size: 29px;
      line-height: 1.02;
      font-weight: 800;
      letter-spacing: -0.04em;
    }

    .knowlense-body {
      padding: 18px 28px 28px;
      display: grid;
      align-content: start;
      gap: 18px;
      overflow-y: auto;
      overscroll-behavior: contain;
      flex: 1;
    }

    .knowlense-product-meta {
      display: grid;
      gap: 10px;
      padding: 0 0 6px;
    }

    .knowlense-meta-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .knowlense-meta-value {
      font-size: 16px;
      line-height: 1.55;
      color: #0f172a;
      font-weight: 700;
    }

    .knowlense-tab-panel {
      display: block;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
    }

    .knowlense-tab-panel.is-active {
      display: block;
    }

    .knowlense-input-label {
      display: block;
      margin-bottom: 6px;
      font-size: 11px;
      color: #475569;
      font-weight: 700;
    }

    .knowlense-keyword-input {
      width: 100%;
      min-height: 72px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 14px;
      padding: 10px 12px;
      font: inherit;
      font-size: 13px;
      line-height: 1.5;
      color: #0f172a;
      resize: vertical;
      outline: none;
    }

    .knowlense-keyword-input:focus {
      border-color: rgba(109, 94, 252, 0.36);
      box-shadow: 0 0 0 4px rgba(109, 94, 252, 0.1);
    }

    .knowlense-keyword-help {
      margin-top: 6px;
      font-size: 11px;
      line-height: 1.45;
      color: #64748b;
    }

    .knowlense-keyword-error {
      display: none;
      margin-top: 8px;
      font-size: 12px;
      line-height: 1.45;
      color: #dc2626;
      font-weight: 600;
    }

    .knowlense-keyword-error.is-visible {
      display: block;
    }

    .knowlense-keyword-action {
      width: 100%;
      margin-top: 16px;
      min-height: 48px;
      border: 0;
      border-radius: 999px;
      background: #111827;
      color: #ffffff;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 160ms ease, opacity 160ms ease, background 160ms ease;
    }

    .knowlense-keyword-action:hover:not(:disabled) {
      background: #000000;
      transform: translateY(-1px);
    }

    .knowlense-keyword-action:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .knowlense-keyword-status {
      margin-top: 14px;
      font-size: 14px;
      line-height: 1.6;
      color: #64748b;
    }

    .knowlense-keyword-status.is-error {
      color: #dc2626;
      font-weight: 600;
    }

    .knowlense-keyword-results {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }

    .knowlense-health-results {
      display: grid;
      gap: 14px;
      margin-top: 18px;
    }

    .knowlense-rewrite-shell {
      display: none;
      margin-top: 24px;
      padding-top: 22px;
      border-top: 1px solid rgba(148, 163, 184, 0.16);
    }

    .knowlense-rewrite-shell.is-visible {
      display: block;
    }

    .knowlense-rewrite-head {
      display: grid;
      gap: 8px;
    }

    .knowlense-rewrite-kicker {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #475569;
    }

    .knowlense-rewrite-title {
      font-size: 22px;
      line-height: 1.15;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #0f172a;
    }

    .knowlense-rewrite-copy {
      margin: 0;
      font-size: 14px;
      line-height: 1.65;
      color: #64748b;
    }

    .knowlense-rewrite-controls {
      display: grid;
      gap: 12px;
      margin-top: 16px;
    }

    .knowlense-rewrite-label {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      color: #475569;
      font-weight: 700;
    }

    .knowlense-rewrite-input {
      width: 100%;
      min-height: 46px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 16px;
      padding: 11px 14px;
      font: inherit;
      font-size: 14px;
      line-height: 1.4;
      color: #0f172a;
      outline: none;
      background: rgba(255, 255, 255, 0.9);
    }

    .knowlense-rewrite-input:focus {
      border-color: rgba(109, 94, 252, 0.36);
      box-shadow: 0 0 0 4px rgba(109, 94, 252, 0.1);
    }

    .knowlense-rewrite-results {
      display: grid;
      gap: 18px;
      margin-top: 18px;
    }

    .knowlense-rewrite-section {
      display: grid;
      gap: 12px;
    }

    .knowlense-rewrite-section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .knowlense-rewrite-section-title {
      font-size: 16px;
      line-height: 1.3;
      font-weight: 800;
      color: #0f172a;
    }

    .knowlense-rewrite-section-meta {
      font-size: 12px;
      line-height: 1.4;
      color: #64748b;
      font-weight: 700;
    }

    .knowlense-rewrite-grid {
      display: grid;
      gap: 12px;
    }

    .knowlense-rewrite-option {
      display: grid;
      gap: 12px;
      padding: 16px;
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(248, 250, 252, 0.96) 0%, rgba(255, 255, 255, 0.98) 100%);
      border: 1px solid rgba(148, 163, 184, 0.14);
    }

    .knowlense-rewrite-option-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .knowlense-rewrite-option-title {
      font-size: 15px;
      line-height: 1.35;
      font-weight: 800;
      color: #0f172a;
    }

    .knowlense-rewrite-badges {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 6px;
    }

    .knowlense-rewrite-badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 5px 9px;
      font-size: 11px;
      line-height: 1.2;
      font-weight: 700;
      white-space: nowrap;
    }

    .knowlense-rewrite-badge.score-up {
      background: #ecfdf5;
      color: #047857;
    }

    .knowlense-rewrite-badge.score-flat {
      background: #f8fafc;
      color: #475569;
    }

    .knowlense-rewrite-value {
      padding: 14px 16px;
      border-radius: 16px;
      background: #ffffff;
      border: 1px solid rgba(148, 163, 184, 0.16);
      font-size: 14px;
      line-height: 1.7;
      color: #0f172a;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .knowlense-rewrite-rationale {
      margin: 0;
      font-size: 13px;
      line-height: 1.6;
      color: #64748b;
    }

    .knowlense-rewrite-validation-list {
      display: grid;
      gap: 8px;
    }

    .knowlense-rewrite-validation {
      display: grid;
      grid-template-columns: 18px 1fr;
      gap: 10px;
      align-items: start;
      font-size: 13px;
      line-height: 1.6;
      color: #334155;
    }

    .knowlense-rewrite-validation strong {
      color: #0f172a;
    }

    .knowlense-rewrite-actions {
      display: flex;
      justify-content: flex-end;
    }

    .knowlense-rewrite-copy-action {
      border: 0;
      border-radius: 999px;
      padding: 10px 14px;
      background: #111827;
      color: #ffffff;
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 160ms ease, background 160ms ease, opacity 160ms ease;
    }

    .knowlense-rewrite-copy-action:hover {
      background: #000000;
      transform: translateY(-1px);
    }

    .knowlense-keyword-card {
      border: 0;
      border-radius: 0;
      background: transparent;
      padding: 0;
    }

    .knowlense-keyword-card-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: flex-start;
      margin-bottom: 14px;
    }

    .knowlense-keyword-name {
      font-size: 18px;
      line-height: 1.4;
      font-weight: 800;
      color: #0f172a;
    }

    .knowlense-keyword-score {
      border-radius: 999px;
      background: #f8f7ff;
      color: #6d5efc;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    .knowlense-check-list {
      display: grid;
      gap: 10px;
    }

    .knowlense-check-group {
      display: grid;
      gap: 10px;
    }

    .knowlense-check-group + .knowlense-check-group {
      margin-top: 18px;
      padding-top: 18px;
      border-top: 1px solid rgba(148, 163, 184, 0.14);
    }

    .knowlense-check-group-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .knowlense-check-group-title {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #475569;
    }

    .knowlense-check-group-summary {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      background: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.18);
      padding: 4px 9px;
      font-size: 11px;
      line-height: 1.2;
      font-weight: 700;
      color: #64748b;
    }

    .knowlense-check-row {
      display: grid;
      grid-template-columns: 18px 1fr;
      gap: 10px;
      align-items: start;
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
    }

    .knowlense-check-mark {
      width: 18px;
      height: 18px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 800;
      margin-top: 1px;
    }

    .knowlense-check-mark.good {
      background: #ecfdf5;
      color: #059669;
    }

    .knowlense-check-mark.bad {
      background: #fef2f2;
      color: #dc2626;
    }

    .knowlense-check-copy {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .knowlense-rank-trophy {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      color: #d97706;
      flex: 0 0 auto;
    }

    .knowlense-rank-trophy svg {
      width: 14px;
      height: 14px;
      display: block;
    }

    .knowlense-suggestion-block {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(148, 163, 184, 0.14);
    }

    .knowlense-suggestion-label {
      margin-bottom: 6px;
      font-size: 11px;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .knowlense-track-toggle {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(148, 163, 184, 0.14);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .knowlense-track-toggle-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      line-height: 1.4;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
    }

    .knowlense-track-toggle-label input {
      margin: 0;
      width: 14px;
      height: 14px;
      accent-color: #6d5efc;
    }

    .knowlense-track-toggle-meta {
      font-size: 11px;
      line-height: 1.4;
      color: #64748b;
      text-align: right;
    }

    .knowlense-chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .knowlense-chip {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      background: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.18);
      padding: 4px 8px;
      font-size: 11px;
      color: #475569;
    }

    .knowlense-panel-heading {
      font-size: 25px;
      line-height: 1.08;
      font-weight: 800;
      letter-spacing: -0.03em;
      margin: 0 0 10px;
    }

    .knowlense-panel-copy {
      margin: 0;
      font-size: 16px;
      line-height: 1.65;
      color: #64748b;
    }

    @media (max-width: 1180px) {
      #${BUBBLE_ID} {
        width: 44px;
        height: 152px;
      }

      #${BUBBLE_ID}.is-open {
        width: 28px;
        height: 136px;
      }

      #${PANEL_ID} {
        width: min(540px, calc(100vw - 36px));
      }
    }

    @media (max-width: 820px) {
      #${BUBBLE_ID} {
        top: auto;
        bottom: 18px;
        right: 0;
        transform: none;
        width: 132px;
        height: 48px;
        border-right: 0;
        border-radius: 16px 0 0 16px;
      }

      #${BUBBLE_ID}.is-open {
        width: 52px;
        height: 44px;
      }

      #${BUBBLE_ID} svg {
        position: static;
        width: 18px;
        height: 18px;
      }

      #${BUBBLE_ID} .knowlense-bubble-copy {
        position: static;
        transform: none;
        letter-spacing: 0.08em;
      }

      #${BUBBLE_ID}.is-open svg {
        right: auto;
        bottom: auto;
        margin-bottom: 0;
      }

      #${PANEL_ID} {
        top: auto;
        bottom: 0;
        width: 100vw;
        height: min(82vh, 900px);
        border-radius: 24px 24px 0 0;
        border-right: 1px solid rgba(15, 23, 42, 0.08);
        box-shadow: 0 -24px 60px rgba(15, 23, 42, 0.16);
      }

      #${PANEL_ID}[hidden] {
        transform: translateY(calc(100% - 14px));
      }

      .knowlense-shell {
        height: 100%;
      }

      .knowlense-header {
        padding: 22px 20px 12px;
      }

      .knowlense-body {
        padding: 16px 20px 22px;
      }

      .knowlense-title,
      .knowlense-panel-heading {
        font-size: 22px;
      }

      .knowlense-panel-copy {
        font-size: 15px;
      }
    }
  `;

  (document.head || document.documentElement || document.body).appendChild(style);
}

function setPanelStatus(node, message, tone = "info") {
  if (!node) {
    return;
  }

  node.textContent = message;
  node.classList.toggle("is-error", tone === "error");
}

function setHealthStatus(message, tone = "info") {
  setPanelStatus(PANEL_STATE.healthStatus, message, tone);
}

function setRewriteStatus(message, tone = "info") {
  setPanelStatus(PANEL_STATE.rewriteStatus, message, tone);
}

function setRewriteVisibility(isVisible) {
  if (!PANEL_STATE.rewriteShell) {
    return;
  }

  PANEL_STATE.rewriteShell.classList.toggle("is-visible", Boolean(isVisible));
}

function formatRewriteValue(value) {
  return escapeHtml(String(value ?? "")).replace(/\n/g, "<br>");
}

function buildRewriteValidation(validation) {
  return `
    <div class="knowlense-rewrite-validation">
      <span class="knowlense-check-mark ${validation.passed ? "good" : "bad"}">${validation.passed ? "&#10003;" : "&#215;"}</span>
      <span><strong>${escapeHtml(validation.label)}:</strong> ${escapeHtml(validation.detail)}</span>
    </div>
  `;
}

function buildRewriteOption(option, label) {
  const scoreClass = option.scoreDelta > 0 ? "score-up" : "score-flat";
  const scoreLabel = option.scoreDelta > 0 ? `+${option.scoreDelta} SEO Health` : `${option.seoHealthScore}/100 checked`;
  const validations = (option.validations || []).map(buildRewriteValidation).join("");

  return `
    <article class="knowlense-rewrite-option">
      <div class="knowlense-rewrite-option-head">
        <div class="knowlense-rewrite-option-title">${escapeHtml(label)}</div>
        <div class="knowlense-rewrite-badges">
          <span class="knowlense-rewrite-badge ${scoreClass}">${escapeHtml(scoreLabel)}</span>
        </div>
      </div>
      <div class="knowlense-rewrite-value">${formatRewriteValue(option.value)}</div>
      <p class="knowlense-rewrite-rationale">${escapeHtml(option.rationale)}</p>
      <div class="knowlense-rewrite-validation-list">${validations}</div>
      <div class="knowlense-rewrite-actions">
        <button class="knowlense-rewrite-copy-action" data-copy-value="${escapeHtml(option.value)}" type="button">Copy</button>
      </div>
    </article>
  `;
}

function renderProductRewrite(rewrite) {
  if (!PANEL_STATE.rewriteResults) {
    return;
  }

  if (!rewrite) {
    PANEL_STATE.rewriteResults.innerHTML = "";
    return;
  }

  const titleOptions = (rewrite.titleOptions || [])
    .map((option, index) => buildRewriteOption(option, `Title option ${index + 1}`))
    .join("");
  const descriptionOptions = (rewrite.descriptionOptions || [])
    .map((option, index) => buildRewriteOption(option, `Description option ${index + 1}`))
    .join("");
  const sections = [
    rewrite.titleOptions?.length
      ? `
        <section class="knowlense-rewrite-section">
          <div class="knowlense-rewrite-section-head">
            <div class="knowlense-rewrite-section-title">Title rewrites</div>
            <div class="knowlense-rewrite-section-meta">${rewrite.titleOptions.length} option(s) checked</div>
          </div>
          <div class="knowlense-rewrite-grid">${titleOptions}</div>
        </section>
      `
      : "",
    rewrite.descriptionOptions?.length
      ? `
        <section class="knowlense-rewrite-section">
          <div class="knowlense-rewrite-section-head">
            <div class="knowlense-rewrite-section-title">Description rewrites</div>
            <div class="knowlense-rewrite-section-meta">${rewrite.descriptionOptions.length} option(s) checked</div>
          </div>
          <div class="knowlense-rewrite-grid">${descriptionOptions}</div>
        </section>
      `
      : ""
  ]
    .filter(Boolean)
    .join("");

  PANEL_STATE.rewriteResults.innerHTML = sections;
}

async function loadExtensionSession() {
  const stored = await chrome.storage.local.get(["knowlense_extension_session", "knowlense_settings"]);
  const apiUrl = stored.knowlense_settings?.apiUrl || "https://api.knowlense.com";
  let session = stored.knowlense_extension_session ?? null;

  if (session?.sessionToken) {
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/v1/me`, {
        headers: {
          Authorization: `Bearer ${session.sessionToken}`
        }
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 401) {
        session = null;
        await chrome.storage.local.remove("knowlense_extension_session");
      } else if (response.ok && payload?.user) {
        session = {
          ...session,
          user: payload.user,
          billing: payload.billing ?? null
        };
        await chrome.storage.local.set({ knowlense_extension_session: session });
      }
    } catch {
      // Keep the stored session as-is if the refresh fails.
    }
  }

  return {
    session,
    apiUrl
  };
}

async function refreshPanelConnectionState() {
  const sessionState = await loadExtensionSession().catch(() => ({ session: null }));
  const isConnected = Boolean(sessionState?.session?.sessionToken);

  if (PANEL_STATE.healthAction) {
    PANEL_STATE.healthAction.disabled = false;
    PANEL_STATE.healthAction.removeAttribute("title");
  }

  if (PANEL_STATE.rewriteAction) {
    PANEL_STATE.rewriteAction.disabled = false;
    PANEL_STATE.rewriteAction.removeAttribute("title");
  }

  if (PANEL_STATE.healthStatus && !isConnected && !PANEL_STATE.healthResults?.innerHTML) {
    setHealthStatus("Connect your account from the website before using SEO Health.", "error");
  } else if (PANEL_STATE.healthStatus && isConnected && !PANEL_STATE.healthResults?.innerHTML) {
    setHealthStatus("Check the full product quality, metadata, media, description, reviews, and store signals.");
  }

  if (PANEL_STATE.rewriteStatus && !isConnected && !PANEL_STATE.rewriteResults?.innerHTML) {
    setRewriteStatus("Connect your account from the website before using AI Rewrite.", "error");
  } else if (PANEL_STATE.rewriteStatus && isConnected && !PANEL_STATE.rewriteResults?.innerHTML) {
    setRewriteStatus("Run SEO Health first, then generate validated title and description options.");
  }
}

async function requireConnectedExtensionSession(featureName) {
  const sessionState = await loadExtensionSession();
  if (!sessionState.session?.sessionToken) {
    throw new Error(`Connect your account from the website before using ${featureName}.`);
  }

  return sessionState;
}

function refreshMountedProductMeta() {
  if (!PANEL_STATE.productMetaValue) {
    return;
  }

  const liveTitle = textFromNode(document.querySelector("h1"));
  if (liveTitle) {
    PANEL_STATE.productMetaValue.textContent = liveTitle;
  }
}

function buildKeywordCheck(message, passed, options = {}) {
  const renderedMessage = options.allowHtml ? String(message ?? "") : escapeHtml(message);
  return `
    <div class="knowlense-check-row">
      <span class="knowlense-check-mark ${passed ? "good" : "bad"}">${passed ? "&#10003;" : "&#215;"}</span>
      <span class="knowlense-check-copy">${renderedMessage}</span>
    </div>
  `;
}

function renderSeoHealthResult(analysis) {
  if (!PANEL_STATE.healthResults) {
    return;
  }

  if (!analysis?.health) {
    PANEL_STATE.healthResults.innerHTML = "";
    renderProductRewrite(null);
    setRewriteVisibility(false);
    return;
  }

  const groupDefinitions = [
    {
      title: "Search Visibility",
      ids: ["title-length", "subjects", "tags"]
    },
    {
      title: "Product Completeness",
      ids: ["grades", "pages", "description-length"]
    },
    {
      title: "Media & Buyer Experience",
      ids: ["product-images", "preview", "video"]
    },
    {
      title: "Conversion & Store Growth",
      ids: ["discount", "internal-links", "bundle-inclusion", "product-pricing", "recent-reviews", "recent-review-frequency", "review-score"]
    }
  ];

  const criteriaById = new Map(analysis.health.criteria.map((criterion) => [criterion.id, criterion]));
  const groupedChecks = groupDefinitions
    .map((group) => {
      const items = group.ids
        .map((id) => criteriaById.get(id))
        .filter(Boolean);

      if (!items.length) {
        return "";
      }

      const passedCount = items.filter((criterion) => criterion.passed).length;
      const checks = items
        .map((criterion) => buildKeywordCheck(criterion.message, criterion.passed))
        .join("");

      return `
        <div class="knowlense-check-group">
          <div class="knowlense-check-group-head">
            <div class="knowlense-check-group-title">${group.title}</div>
            <div class="knowlense-check-group-summary">${passedCount} of ${items.length} checks passed</div>
          </div>
          <div class="knowlense-check-list">${checks}</div>
        </div>
      `;
    })
    .join("");

  PANEL_STATE.healthResults.innerHTML = `
    <div class="knowlense-keyword-card">
      <div class="knowlense-keyword-card-head">
        <div class="knowlense-keyword-name">SEO Health</div>
        <div class="knowlense-keyword-score">${analysis.health.seoHealthScore}/100</div>
      </div>
      ${groupedChecks}
    </div>
  `;
  setRewriteVisibility(true);
}

async function runProductRewrite(primaryKeyword) {
  const fetchedDocument = await fetchProductPageDocument().catch(() => null);
  const liveExtracted = extractProductSnapshot(document);
  if (!liveExtracted.ok) {
    throw new Error(liveExtracted.error);
  }

  const fetchedExtracted = fetchedDocument ? extractProductSnapshot(fetchedDocument) : null;
  const snapshot = {
    ...((fetchedExtracted && fetchedExtracted.ok ? fetchedExtracted.snapshot : {}) || {}),
    ...liveExtracted.snapshot
  };

  snapshot.descriptionLinkDetails = await resolveDescriptionLinkDetails(snapshot.descriptionProductLinks || []);

  const sessionState = await requireConnectedExtensionSession("AI Rewrite");
  const baseUrl = sessionState.apiUrl.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/v1/product-seo-health/rewrite`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionState.session.sessionToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      snapshot,
      primaryKeyword: primaryKeyword || ""
    })
  });

  const payload = await response.json().catch(() => null);
  if (response.status === 401) {
    await chrome.storage.local.remove("knowlense_extension_session");
    throw new Error("Your extension session expired. Reconnect it from the website and try again.");
  }

  if (!response.ok || !payload?.rewrite) {
    throw new Error(payload?.error || "Knowlense could not generate AI Rewrite.");
  }

  return payload;
}

async function runSeoHealthAudit() {
  const fetchedDocument = await fetchProductPageDocument().catch(() => null);
  const liveExtracted = extractProductSnapshot(document);
  if (!liveExtracted.ok) {
    throw new Error(liveExtracted.error);
  }

  const fetchedExtracted = fetchedDocument ? extractProductSnapshot(fetchedDocument) : null;
  const extracted = {
    ok: true,
    snapshot: {
      ...((fetchedExtracted && fetchedExtracted.ok ? fetchedExtracted.snapshot : {}) || {}),
      ...liveExtracted.snapshot
    }
  };

  if (!extracted.ok) {
    throw new Error(extracted.error);
  }

  extracted.snapshot.descriptionLinkDetails = await resolveDescriptionLinkDetails(
    extracted.snapshot.descriptionProductLinks || []
  );

  const sessionState = await requireConnectedExtensionSession("SEO Health");

  const baseUrl = sessionState.apiUrl.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/v1/product-seo-health/analyze`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionState.session.sessionToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(extracted.snapshot)
  });

  const payload = await response.json().catch(() => null);

  if (response.status === 401) {
    await chrome.storage.local.remove("knowlense_extension_session");
    throw new Error("Your extension session expired. Reconnect it from the website and try again.");
  }

  if (!response.ok || !payload?.analysis?.health) {
    throw new Error(payload?.error || "Knowlense could not run SEO Health.");
  }

  return payload.analysis;
}

function createPanelShell() {
  injectStyles();

  const mountRoot = document.body || document.documentElement;
  if (!mountRoot) {
    return;
  }

  const meta = extractProductMeta();

  const bubble = document.createElement("button");
  bubble.id = BUBBLE_ID;
  bubble.type = "button";
  bubble.setAttribute("aria-controls", PANEL_ID);
  bubble.setAttribute("aria-label", "Open Knowlense SEO Health");
  bubble.setAttribute("aria-expanded", "false");
  bubble.innerHTML = `
    <span class="knowlense-bubble-copy">SEO Health</span>
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 5.5 15 12 8 18.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;

  const panel = document.createElement("aside");
  panel.id = PANEL_ID;
  panel.hidden = true;
  panel.innerHTML = `
    <div class="knowlense-shell">
      <div class="knowlense-header">
        <div class="knowlense-badge">Knowlense</div>
        <h3 class="knowlense-title">SEO Health Audit</h3>
        <p class="knowlense-panel-copy">Review the full product page against the main TPT product SEO criteria.</p>
      </div>
      <div class="knowlense-body">
        <div class="knowlense-product-meta">
          <div>
            <div class="knowlense-meta-label">Product</div>
            <div class="knowlense-meta-value">${escapeHtml(meta.title)}</div>
          </div>
        </div>
        <div class="knowlense-tab-panel is-active" data-panel="criteria-seo">
          <button class="knowlense-keyword-action knowlense-health-action" type="button">Run SEO Health</button>
          <div class="knowlense-keyword-status knowlense-health-status">Check the full product quality, metadata, media, description, reviews, and store signals.</div>
          <div class="knowlense-health-results"></div>
          <div class="knowlense-rewrite-shell">
            <div class="knowlense-rewrite-head">
              <div class="knowlense-rewrite-kicker">AI Rewrite</div>
              <div class="knowlense-rewrite-title">Generate validated title and description options</div>
              <p class="knowlense-rewrite-copy">Use Gemini to rewrite the current listing copy, then let Knowlense check each option against the active SEO Health rules before you copy it back into TPT.</p>
            </div>
            <div class="knowlense-rewrite-controls">
              <div>
                <label class="knowlense-rewrite-label" for="knowlense-rewrite-keyword">Primary keyword (optional)</label>
                <input id="knowlense-rewrite-keyword" class="knowlense-rewrite-input" type="text" placeholder="Example: reading comprehension passages" />
              </div>
              <button class="knowlense-keyword-action knowlense-rewrite-action" type="button">Generate AI Rewrite</button>
              <div class="knowlense-keyword-status knowlense-rewrite-status">Run SEO Health first, then generate validated title and description options.</div>
            </div>
            <div class="knowlense-rewrite-results"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  mountRoot.appendChild(bubble);
  mountRoot.appendChild(panel);

  bubble.addEventListener("click", () => {
    syncPanelVisibility(panel.hidden);
  });

  PANEL_STATE.bubble = bubble;
  PANEL_STATE.panel = panel;
  PANEL_STATE.healthAction = panel.querySelector(".knowlense-health-action");
  PANEL_STATE.healthStatus = panel.querySelector(".knowlense-health-status");
  PANEL_STATE.healthResults = panel.querySelector(".knowlense-health-results");
  PANEL_STATE.rewriteShell = panel.querySelector(".knowlense-rewrite-shell");
  PANEL_STATE.rewriteAction = panel.querySelector(".knowlense-rewrite-action");
  PANEL_STATE.rewriteStatus = panel.querySelector(".knowlense-rewrite-status");
  PANEL_STATE.rewriteResults = panel.querySelector(".knowlense-rewrite-results");
  PANEL_STATE.rewriteKeywordInput = panel.querySelector(".knowlense-rewrite-input");
  PANEL_STATE.productMetaValue = panel.querySelector(".knowlense-meta-value");
  syncPanelVisibility(false);
  refreshMountedProductMeta();
  refreshPanelConnectionState();

  PANEL_STATE.healthAction?.addEventListener("click", async () => {
    renderSeoHealthResult(null);
    PANEL_STATE.healthAction.disabled = true;
    PANEL_STATE.healthAction.textContent = "Analyzing...";
    setHealthStatus("Running SEO Health for this product...");

    try {
      const analysis = await runSeoHealthAudit();
      renderSeoHealthResult(analysis);
      setHealthStatus("SEO Health audit completed.");
    } catch (error) {
      setHealthStatus(error instanceof Error ? error.message : "Knowlense could not run SEO Health.", "error");
    } finally {
      PANEL_STATE.healthAction.disabled = false;
      PANEL_STATE.healthAction.textContent = "Run SEO Health";
    }
  });

  PANEL_STATE.rewriteAction?.addEventListener("click", async () => {
    if (!PANEL_STATE.healthResults?.innerHTML) {
      setRewriteStatus("Run SEO Health first so Knowlense can validate the rewrite against the current page.", "error");
      return;
    }

    renderProductRewrite(null);
    PANEL_STATE.rewriteAction.disabled = true;
    PANEL_STATE.rewriteAction.textContent = "Generating...";
    setRewriteStatus("Generating AI rewrite options and checking them against SEO Health...");

    try {
      const payload = await runProductRewrite(PANEL_STATE.rewriteKeywordInput?.value || "");
      renderProductRewrite(payload.rewrite);
      if (payload.usage?.premium) {
        setRewriteStatus("AI rewrite completed. Premium access includes expanded rewrite capacity.");
      } else if (typeof payload.usage?.used === "number" && typeof payload.usage?.limit === "number") {
        setRewriteStatus(`AI rewrite completed. ${payload.usage.used} of ${payload.usage.limit} free rewrite runs used in the last 24 hours.`);
      } else {
        setRewriteStatus("AI rewrite completed.");
      }
    } catch (error) {
      setRewriteStatus(error instanceof Error ? error.message : "Knowlense could not generate AI Rewrite.", "error");
    } finally {
      PANEL_STATE.rewriteAction.disabled = false;
      PANEL_STATE.rewriteAction.textContent = "Generate AI Rewrite";
    }
  });

  PANEL_STATE.rewriteResults?.addEventListener("click", async (event) => {
    const target = event.target?.closest?.("[data-copy-value]");
    if (!target) {
      return;
    }

    const value = target.getAttribute("data-copy-value") || "";
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setRewriteStatus("Copied rewrite to clipboard.");
    } catch {
      setRewriteStatus("Knowlense could not copy this rewrite automatically. Copy it manually from the panel.", "error");
    }
  });

}

function unmountPanelShell() {
  if (PANEL_STATE.bubble) {
    PANEL_STATE.bubble.remove();
    PANEL_STATE.bubble = null;
  }

  if (PANEL_STATE.panel) {
    PANEL_STATE.panel.remove();
    PANEL_STATE.panel = null;
  }

  PANEL_STATE.healthAction = null;
  PANEL_STATE.healthStatus = null;
  PANEL_STATE.healthResults = null;
  PANEL_STATE.rewriteShell = null;
  PANEL_STATE.rewriteAction = null;
  PANEL_STATE.rewriteStatus = null;
  PANEL_STATE.rewriteResults = null;
  PANEL_STATE.rewriteKeywordInput = null;
  PANEL_STATE.productMetaValue = null;

  PANEL_STATE.mountedUrl = null;
}

function mountProductPanel() {
  if (!isProductPage()) {
    unmountPanelShell();
    return;
  }

  if (!document.body && !document.documentElement) {
    return;
  }

  if (PANEL_STATE.mountedUrl === window.location.href && PANEL_STATE.panel && PANEL_STATE.bubble) {
    refreshMountedProductMeta();
    return;
  }

  unmountPanelShell();
  createPanelShell();
  PANEL_STATE.mountedUrl = window.location.href;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "knowlense.extractSearchSnapshot") {
    return;
  }

  sendResponse(extractSearchSnapshot());
});

mountProductPanel();
setInterval(() => {
  if (document.visibilityState !== "visible") {
    return;
  }
  mountProductPanel();
}, 5000);

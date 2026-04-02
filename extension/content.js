const PANEL_ID = "knowlense-product-panel";
const STYLE_ID = "knowlense-product-panel-style";
const BUBBLE_ID = "knowlense-product-bubble";

const PANEL_STATE = {
  mountedUrl: null,
  bubble: null,
  panel: null,
  activeTab: "keyword-seo",
  keywordInput: null,
  keywordAction: null,
  keywordError: null,
  keywordStatus: null,
  keywordResults: null,
  healthAction: null,
  healthStatus: null,
  healthResults: null,
  indexingAction: null,
  indexingStatus: null,
  indexingResults: null,
  productMetaValue: null
};

function textFromNode(node) {
  return node?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function textFromRoot(root = document) {
  return root?.body?.innerText?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeText(value) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
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

function decodeHtmlHref(value) {
  return value
    ?.replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isLikelySearchResultContainer(container) {
  const text = textFromNode(container);
  if (!text) {
    return false;
  }

  return /\$\d+(?:\.\d{2})?/.test(text) || /add to cart/i.test(text) || /wish list/i.test(text);
}

function hasProductLink(container) {
  return Boolean(container?.querySelector("a[href*='/Product/']"));
}

function hasCommerceSignals(container) {
  const text = textFromNode(container);
  return /\$\d+(?:\.\d{2})?/.test(text) || /add to cart/i.test(text);
}

function findResultContainerFromActionNode(node) {
  let current = node?.parentElement;
  while (current && current !== current.ownerDocument.body) {
    if (hasProductLink(current) && hasCommerceSignals(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function findSearchResultContainer(link, root) {
  const explicit = link.closest(
    "article, li, [data-resource-id], [data-product-id], .SearchResultsPage__result, .product-list-item, [class*='search-result'], [class*='SearchResult']"
  );
  if (explicit && isLikelySearchResultContainer(explicit)) {
    return explicit;
  }

  let node = link.parentElement;
  while (node && node !== root.body) {
    if (isLikelySearchResultContainer(node)) {
      return node;
    }
    node = node.parentElement;
  }

  return null;
}

function buildSearchResultFromContainer(container) {
  const anchors = [...container.querySelectorAll("a[href*='/Product/']")];
  if (anchors.length === 0) {
    return null;
  }

  const candidates = anchors
    .map((anchor, index) => {
      const href = decodeHtmlHref(anchor.getAttribute("href"));
      if (!href) {
        return null;
      }

      const absolute = new URL(href, window.location.origin).toString();
      const text = textFromNode(anchor);
      const ancestorText = textFromNode(anchor.parentElement);
      return {
        index,
        anchor,
        productUrl: absolute,
        normalizedUrl: normalizeProductUrl(absolute),
        title: text,
        inBundleMeta: /also included in|bundle/i.test(ancestorText)
      };
    })
    .filter(Boolean);

  if (candidates.length === 0) {
    return null;
  }

  const primaryCandidates = candidates.filter((candidate) => !candidate.inBundleMeta);
  const meaningfulPrimaryCandidates = primaryCandidates.filter((candidate) => candidate.title && candidate.title.length >= 8);
  const meaningfulCandidates = candidates.filter((candidate) => candidate.title && candidate.title.length >= 8);

  const best =
    meaningfulPrimaryCandidates[0] ||
    meaningfulCandidates[0] ||
    primaryCandidates[0] ||
    candidates[0];

  if (!best?.title) {
    return null;
  }

  return {
    productUrl: best.productUrl,
    normalizedUrl: best.normalizedUrl,
    title: best.title,
    shopName:
      [...container.querySelectorAll("a[href^='/store/'], a[href*='/store/']")]
        .map((anchor) => textFromNode(anchor))
        .find(Boolean) || "",
    priceText: textFromNode(container).match(/\$\d+(?:\.\d{2})?/)?.[0] || "",
    snippet:
      textFromNode(container)
        .split(/\n|\s{2,}/)
        .map((line) => line.trim())
        .filter(Boolean)
        .find((line) => line !== best.title && !/\$\d+(?:\.\d{2})?/.test(line) && line.length > 24) || ""
  };
}

function parseSearchResultsFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const actionNodes = [...doc.querySelectorAll("button, a, span, div")].filter((node) => /add to cart/i.test(textFromNode(node)));
  const seenContainers = new Set();
  const seenUrls = new Set();
  const results = [];

  actionNodes.forEach((node) => {
    const container = findResultContainerFromActionNode(node);
    if (!container) {
      return;
    }

    const containerKey =
      container.getAttribute("data-resource-id") ||
      container.getAttribute("data-product-id") ||
      `${container.tagName}:${textFromNode(container).slice(0, 160)}`;

    if (seenContainers.has(containerKey)) {
      return;
    }

    const result = buildSearchResultFromContainer(container);
    if (!result || seenUrls.has(result.normalizedUrl)) {
      return;
    }

    seenContainers.add(containerKey);
    seenUrls.add(result.normalizedUrl);
    results.push({
      productUrl: result.productUrl,
      title: result.title
    });
  });

  if (results.length > 0) {
    return results;
  }

  const productLinks = [...doc.querySelectorAll("a[href*='/Product/']")];
  productLinks.forEach((link) => {
    const container = findSearchResultContainer(link, doc);
    if (!container) {
      return;
    }

    const containerKey =
      container.getAttribute("data-resource-id") ||
      container.getAttribute("data-product-id") ||
      `${container.tagName}:${textFromNode(container).slice(0, 160)}`;

    if (seenContainers.has(containerKey)) {
      return;
    }

    const result = buildSearchResultFromContainer(container);
    if (!result || seenUrls.has(result.normalizedUrl)) {
      return;
    }

    seenContainers.add(containerKey);
    seenUrls.add(result.normalizedUrl);
    results.push({
      productUrl: result.productUrl,
      title: result.title
    });
  });

  return results;
}

async function scanKeywordSearch(productUrl, keyword) {
  const currentProduct = normalizeProductUrl(productUrl);
  const searchUrl = `${window.location.origin}/browse?search=${encodeURIComponent(keyword)}`;
  const serpTitles = [];
  const results = [];
  let rank = {
    status: "beyond_page_3",
    position: 74,
    resultPage: null,
    pagePosition: null,
    searchUrl
  };

  for (let page = 1; page <= 3; page += 1) {
    const pageUrl = page === 1 ? searchUrl : `${searchUrl}&page=${page}`;
    const response = await fetch(pageUrl, { credentials: "include" });
    if (!response.ok) {
      continue;
    }

      const html = await response.text();
      const searchResults = parseSearchResultsFromHtml(html);
      serpTitles.push(...searchResults.map((result) => result.title));
      searchResults.forEach((result, index) => {
        results.push({
          position: (page - 1) * 18 + index + 1,
          title: result.title,
          productUrl: result.productUrl,
          shopName: result.shopName || "",
          priceText: result.priceText || "",
          snippet: result.snippet || ""
        });
      });

      if (rank.status !== "ranked") {
        for (let index = 0; index < searchResults.length; index += 1) {
          if (normalizeProductUrl(searchResults[index].productUrl) === currentProduct) {
            const pagePosition = index + 1;
            rank = {
              status: "ranked",
            position: pagePosition,
            resultPage: page,
            pagePosition,
            searchUrl
          };
          break;
        }
      }
    }
  }

  return {
    rank,
    serpTitles: serpTitles.slice(0, 48),
    results: results.slice(0, 54)
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
      top: 146px;
      right: 18px;
      z-index: 2147483645;
      width: 50px;
      height: 50px;
      border: 1px solid rgba(15, 23, 42, 0.1);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.14);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
      backdrop-filter: blur(10px);
    }

    #${BUBBLE_ID}:hover {
      transform: translateY(-1px);
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.18);
      background: #ffffff;
    }

    #${BUBBLE_ID} svg {
      width: 30px;
      height: 30px;
      color: #6d5efc;
    }

    #${PANEL_ID} {
      position: fixed;
      top: 146px;
      right: 76px;
      z-index: 2147483644;
      width: min(320px, calc(100vw - 112px));
      max-height: calc(100vh - 176px);
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.16);
      backdrop-filter: blur(10px);
      font-family: Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #0f172a;
      overflow: hidden;
      transform-origin: top right;
      transition: opacity 160ms ease, transform 160ms ease;
    }

    #${PANEL_ID}[hidden] {
      display: block !important;
      opacity: 0;
      transform: translateY(-6px) scale(0.98);
      pointer-events: none;
      visibility: hidden;
    }

    #${PANEL_ID} * {
      box-sizing: border-box;
    }

    .knowlense-shell {
      display: flex;
      flex-direction: column;
      max-height: calc(100vh - 176px);
    }

    .knowlense-header {
      padding: 14px 14px 10px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.16);
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
      margin: 10px 0 0;
      font-size: 16px;
      line-height: 1.1;
      font-weight: 800;
      letter-spacing: -0.04em;
    }

    .knowlense-body {
      padding: 12px;
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    .knowlense-product-meta {
      display: grid;
      gap: 8px;
      padding: 10px 12px;
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 16px;
      background: #ffffff;
      margin-bottom: 12px;
    }

    .knowlense-meta-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .knowlense-meta-value {
      font-size: 13px;
      line-height: 1.45;
      color: #0f172a;
      font-weight: 700;
    }

    .knowlense-tabs {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
      margin-bottom: 10px;
    }

    .knowlense-tab {
      min-height: 38px;
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 12px;
      background: #ffffff;
      padding: 8px;
      font-size: 11px;
      line-height: 1.25;
      font-weight: 700;
      color: #475569;
      cursor: pointer;
      transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
    }

    .knowlense-tab.is-active {
      background: #f8f7ff;
      border-color: rgba(109, 94, 252, 0.22);
      color: #111827;
    }

    .knowlense-tab-panel {
      display: none;
      padding: 12px;
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 16px;
      background: #ffffff;
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
      margin-top: 10px;
      min-height: 42px;
      border: 0;
      border-radius: 999px;
      background: #111827;
      color: #ffffff;
      font-size: 13px;
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
      margin-top: 10px;
      font-size: 12px;
      line-height: 1.5;
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
      gap: 10px;
      margin-top: 12px;
    }

    .knowlense-keyword-card {
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 14px;
      background: #ffffff;
      padding: 12px;
    }

    .knowlense-keyword-card-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: flex-start;
      margin-bottom: 10px;
    }

    .knowlense-keyword-name {
      font-size: 13px;
      line-height: 1.4;
      font-weight: 800;
      color: #0f172a;
    }

    .knowlense-keyword-score {
      border-radius: 999px;
      background: #f8f7ff;
      color: #6d5efc;
      padding: 5px 9px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
    }

    .knowlense-check-list {
      display: grid;
      gap: 7px;
    }

    .knowlense-check-group {
      display: grid;
      gap: 7px;
    }

    .knowlense-check-group + .knowlense-check-group {
      margin-top: 14px;
      padding-top: 14px;
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
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #475569;
    }

    .knowlense-check-group-summary {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      background: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.18);
      padding: 3px 8px;
      font-size: 10px;
      line-height: 1.2;
      font-weight: 700;
      color: #64748b;
    }

    .knowlense-check-row {
      display: grid;
      grid-template-columns: 16px 1fr;
      gap: 8px;
      align-items: start;
      font-size: 12px;
      line-height: 1.45;
      color: #334155;
    }

    .knowlense-check-mark {
      width: 16px;
      height: 16px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
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
      font-size: 14px;
      line-height: 1.3;
      font-weight: 800;
      letter-spacing: -0.03em;
      margin: 0 0 6px;
    }

    .knowlense-panel-copy {
      margin: 0;
      font-size: 12px;
      line-height: 1.55;
      color: #64748b;
    }

    @media (max-width: 1180px) {
      #${BUBBLE_ID} {
        top: auto;
        right: 14px;
        bottom: 18px;
      }

      #${PANEL_ID} {
        top: auto;
        right: 14px;
        bottom: 78px;
        width: min(320px, calc(100vw - 28px));
        max-height: min(72vh, 560px);
      }

      .knowlense-shell {
        max-height: min(72vh, 560px);
      }
    }
  `;

  (document.head || document.documentElement || document.body).appendChild(style);
}

function setActiveTab(tabId) {
  PANEL_STATE.activeTab = tabId;
  if (!PANEL_STATE.panel) {
    return;
  }

  PANEL_STATE.panel.querySelectorAll(".knowlense-tab").forEach((button) => {
    const active = button.getAttribute("data-tab") === tabId;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });

  PANEL_STATE.panel.querySelectorAll(".knowlense-tab-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.getAttribute("data-panel") === tabId);
  });
}

function setKeywordError(message) {
  if (!PANEL_STATE.keywordError) {
    return;
  }

  PANEL_STATE.keywordError.textContent = message || "";
  PANEL_STATE.keywordError.classList.toggle("is-visible", Boolean(message));
}

function setPanelStatus(node, message, tone = "info") {
  if (!node) {
    return;
  }

  node.textContent = message;
  node.classList.toggle("is-error", tone === "error");
}

function setKeywordStatus(message, tone = "info") {
  setPanelStatus(PANEL_STATE.keywordStatus, message, tone);
}

function setHealthStatus(message, tone = "info") {
  setPanelStatus(PANEL_STATE.healthStatus, message, tone);
}

function setIndexingStatus(message, tone = "info") {
  setPanelStatus(PANEL_STATE.indexingStatus, message, tone);
}

function isPremiumSession(session) {
  const status = session?.billing?.status;
  return status === "active" || status === "trial";
}

function parseKeywordInput(rawValue, productTitle, maxKeywords) {
  const normalizedTitle = normalizeText(productTitle);
  const keywords = rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!keywords.length) {
    return { ok: false, error: "Enter at least one keyword." };
  }

  if (keywords.length > maxKeywords) {
    return {
      ok: false,
      error:
        maxKeywords === 1
          ? "Free plan supports 1 keyword at a time. Upgrade to Premium to analyze up to 3 keywords at once."
          : `You can analyze up to ${maxKeywords} keywords at a time.`
    };
  }

  const deduped = [];
  const seen = new Set();

  for (const keyword of keywords) {
    const normalized = normalizeText(keyword);
    if (normalized.length < 3) {
      return { ok: false, error: `Keyword "${keyword}" is too short.` };
    }

    if (keyword.length > 60 || normalized.split(" ").length > 8) {
      return { ok: false, error: `Keyword "${keyword}" is too long. Keep it concise.` };
    }

    if (normalized === normalizedTitle) {
      return { ok: false, error: `Keyword "${keyword}" cannot be identical to the full product title.` };
    }

    if (!seen.has(normalized)) {
      seen.add(normalized);
      deduped.push(keyword);
    }
  }

  return { ok: true, keywords: deduped };
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
  const isPremium = isPremiumSession(sessionState?.session);

  if (PANEL_STATE.healthAction) {
    PANEL_STATE.healthAction.disabled = false;
    PANEL_STATE.healthAction.removeAttribute("title");
  }

  if (PANEL_STATE.keywordAction) {
    PANEL_STATE.keywordAction.disabled = false;
    PANEL_STATE.keywordAction.removeAttribute("title");
  }

  if (PANEL_STATE.indexingAction) {
    PANEL_STATE.indexingAction.disabled = false;
    PANEL_STATE.indexingAction.removeAttribute("title");
  }

  if (PANEL_STATE.healthStatus && !isConnected && !PANEL_STATE.healthResults?.innerHTML) {
    setHealthStatus("Connect your account from the website before using SEO Health.", "error");
  } else if (PANEL_STATE.healthStatus && isConnected && !PANEL_STATE.healthResults?.innerHTML) {
    setHealthStatus("Check the full product quality, metadata, media, description, reviews, and store signals.");
  }

  if (PANEL_STATE.keywordStatus && !isConnected && !PANEL_STATE.keywordResults?.innerHTML) {
    setKeywordStatus("Connect your account from the website before using Keyword SEO.", "error");
  } else if (PANEL_STATE.keywordStatus && isConnected && !PANEL_STATE.keywordResults?.innerHTML) {
    setKeywordStatus(isPremium
      ? "Check rank, title placement, description placement, and related keyword suggestions for up to 3 keywords."
      : "Check rank, title placement, description placement, and related keyword suggestions for 1 keyword at a time on Free.");
  }

  if (PANEL_STATE.indexingStatus && !isConnected && !PANEL_STATE.indexingResults?.innerHTML) {
    setIndexingStatus("Connect your account from the website before using Search Indexing.", "error");
  } else if (PANEL_STATE.indexingStatus && isConnected && !PANEL_STATE.indexingResults?.innerHTML) {
    setIndexingStatus("Check this product across major search engines and see where it is indexed.");
  }

  if (PANEL_STATE.keywordInput) {
    PANEL_STATE.keywordInput.placeholder = isPremium
      ? "Enter up to 3 keywords, separated by commas"
      : "Enter 1 keyword";
  }

  const keywordHelp = PANEL_STATE.panel?.querySelector(".knowlense-keyword-help");
  if (keywordHelp) {
    keywordHelp.textContent = isPremium
      ? "Use up to 3 concise keywords. Separate them with commas."
      : "Free plan supports 1 concise keyword at a time. Upgrade to Premium to analyze up to 3.";
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

function buildKeywordCheck(message, passed) {
  return `
    <div class="knowlense-check-row">
      <span class="knowlense-check-mark ${passed ? "good" : "bad"}">${passed ? "✓" : "×"}</span>
      <span class="knowlense-check-copy">${message}</span>
    </div>
  `;
}

function renderSearchIndexingResult(result) {
  if (!PANEL_STATE.indexingResults) {
    return;
  }

  if (!result?.checks?.length) {
    PANEL_STATE.indexingResults.innerHTML = "";
    return;
  }

  const passedCount = result.checks.filter((item) => item.passed).length;
  const checks = result.checks.map((item) => buildKeywordCheck(item.message, item.passed)).join("");

  PANEL_STATE.indexingResults.innerHTML = `
    <div class="knowlense-keyword-card">
      <div class="knowlense-keyword-card-head">
        <div class="knowlense-keyword-name">Search Indexing</div>
        <div class="knowlense-keyword-score">${passedCount}/${result.checks.length}</div>
      </div>
      <div class="knowlense-check-group">
        <div class="knowlense-check-group-head">
          <div class="knowlense-check-group-title">Search Engine Coverage</div>
          <div class="knowlense-check-group-summary">${passedCount} of ${result.checks.length} checks passed</div>
        </div>
        <div class="knowlense-check-list">${checks}</div>
      </div>
    </div>
  `;
}

async function runSearchIndexingAudit() {
  const extracted = extractProductSnapshot();
  if (!extracted.ok) {
    throw new Error(extracted.error);
  }

  await requireConnectedExtensionSession("Search Indexing");

  const cacheKey = `knowlense_search_indexing_cache_${normalizeProductUrl(extracted.snapshot.productUrl)}`;
  const cached = await chrome.storage.local.get(cacheKey).catch(() => ({}));
  const cachedEntry = cached?.[cacheKey];
  if (cachedEntry?.timestamp && Date.now() - cachedEntry.timestamp < 6 * 60 * 60 * 1000 && cachedEntry?.result?.checks?.length) {
    return cachedEntry.result;
  }

  const response = await chrome.runtime.sendMessage({
    type: "knowlense.searchIndexing.check",
    productUrl: extracted.snapshot.productUrl
  }).catch(() => null);

  if (!response?.ok || !response.result?.checks?.length) {
    throw new Error(response?.error || "Knowlense could not run the search indexing check.");
  }

  await chrome.storage.local
    .set({
      [cacheKey]: {
        timestamp: Date.now(),
        result: response.result
      }
    })
    .catch(() => null);

  return response.result;
}

function countPhraseOccurrences(text, phrase) {
  const normalizedText = normalizeText(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const normalizedPhrase = normalizeText(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  if (!normalizedText || !normalizedPhrase) {
    return 0;
  }

  const matches = normalizeText(text).match(new RegExp(`\\b${normalizedPhrase}\\b`, "g"));
  return matches?.length ?? 0;
}

function firstWords(text, limit) {
  return (text || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, limit)
    .join(" ")
    .trim();
}

function analyzeDescriptionPlacement(descriptionExcerpt, keyword) {
  const leadingDescription = (descriptionExcerpt || "").slice(0, 300);
  const mentionCount = countPhraseOccurrences(leadingDescription, keyword);

  if (mentionCount === 0) {
    return {
      mentionCount,
      status: "missing",
      message: `The description does not reference "${keyword}" at the beginning. Placing the keyword earlier can strengthen search relevance and improve ranking potential for this query.`,
      containsKeyword: false,
      overused: false
    };
  }

  if (mentionCount <= 3) {
    return {
      mentionCount,
      status: "good",
      message: `The description references "${keyword}" at the beginning, which supports stronger search relevance and ranking potential for this query.`,
      containsKeyword: true,
      overused: false
    };
  }

  return {
    mentionCount,
    status: "stuffed",
    message: `The description repeats "${keyword}" too heavily at the beginning. Keep the keyword early, but use it more naturally to preserve readability and balanced optimization.`,
    containsKeyword: true,
    overused: true
  };
}

async function fetchTrackedKeywordTargets(baseUrl, sessionToken, snapshot) {
  const productUrl = encodeURIComponent(snapshot.productUrl || "");
  const productId = encodeURIComponent(snapshot.productId || "");
  const response = await fetch(
    `${baseUrl}/v1/rank-tracking/targets?activeOnly=true&productUrl=${productUrl}${productId ? `&productId=${productId}` : ""}`,
    {
      headers: {
        Authorization: `Bearer ${sessionToken}`
      }
    }
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok || !Array.isArray(payload?.targets)) {
    return new Map();
  }

  return new Map(payload.targets.map((target) => [normalizeText(target.keyword), target]));
}

function bindKeywordTrackingToggles(items, snapshot, session) {
  if (!PANEL_STATE.keywordResults) {
    return;
  }

  const isPremium = isPremiumSession(session);
  const itemMap = new Map(items.map((item) => [normalizeText(item.keyword), item]));
  PANEL_STATE.keywordResults.querySelectorAll("[data-track-keyword]").forEach((input) => {
    if (!isPremium) {
      input.disabled = true;
      const metaNode = input
        .closest(".knowlense-track-toggle")
        ?.querySelector(".knowlense-track-toggle-meta");
      if (metaNode) {
        metaNode.textContent = "Premium required to use keyword tracking.";
      }
      return;
    }

    input.addEventListener("change", async (event) => {
      const checkbox = event.currentTarget;
      const keyword = checkbox.getAttribute("data-track-keyword") || "";
      const normalizedKeyword = normalizeText(keyword);
      const item = itemMap.get(normalizedKeyword);
      const metaNode = checkbox
        .closest(".knowlense-track-toggle")
        ?.querySelector(".knowlense-track-toggle-meta");

      if (!item) {
        checkbox.checked = false;
        return;
      }

      checkbox.disabled = true;
      const sessionState = await loadExtensionSession().catch(() => ({ session: null, apiUrl: "" }));
      const sessionToken = sessionState.session?.sessionToken;
      const baseUrl = sessionState.apiUrl?.replace(/\/$/, "");

      if (!sessionToken || !baseUrl) {
        checkbox.checked = false;
        checkbox.disabled = false;
        if (metaNode) {
          metaNode.textContent = "Connect the extension first.";
        }
        return;
      }

      try {
        if (checkbox.checked) {
          const response = await fetch(`${baseUrl}/v1/rank-tracking/targets`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              productId: snapshot.productId,
              productUrl: snapshot.productUrl,
              productTitle: snapshot.title,
              sellerName: snapshot.sellerName,
              keyword: item.keyword,
              initialCheck: {
                checkedAt: new Date().toISOString(),
                status: item.liveRank.status,
                resultPage: item.liveRank.resultPage,
                pagePosition: item.liveRank.pagePosition,
                searchUrl: item.liveRank.searchUrl
              }
            })
          });
          const payload = await response.json().catch(() => null);

          if (!response.ok || !payload?.target) {
            throw new Error(payload?.error || `Knowlense could not start tracking "${item.keyword}".`);
          }

          checkbox.setAttribute("data-target-id", payload.target.id);
          await chrome.runtime.sendMessage({
            type: "knowlense.rankTracking.upsertTarget",
            target: payload.target
          }).catch(() => null);
          if (metaNode) {
            metaNode.textContent = `Tracking active since ${new Date(payload.target.startedAt).toLocaleDateString()}.`;
          }
        } else {
          const targetId = checkbox.getAttribute("data-target-id");
          if (targetId) {
            const response = await fetch(`${baseUrl}/v1/rank-tracking/targets/${targetId}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${sessionToken}`
              }
            });
            if (!response.ok) {
              const payload = await response.json().catch(() => null);
              throw new Error(payload?.error || `Knowlense could not stop tracking "${item.keyword}".`);
            }
          }
          if (targetId) {
            await chrome.runtime.sendMessage({
              type: "knowlense.rankTracking.removeTarget",
              targetId
            }).catch(() => null);
          }
          checkbox.removeAttribute("data-target-id");
          if (metaNode) {
            metaNode.textContent = "Tracking is off.";
          }
        }
      } catch (error) {
        checkbox.checked = !checkbox.checked;
        if (metaNode) {
          metaNode.textContent = error instanceof Error ? error.message : "Tracking could not be updated.";
        }
      } finally {
        checkbox.disabled = false;
      }
    });
  });
}

function renderKeywordResults(items) {
  if (!PANEL_STATE.keywordResults) {
    return;
  }

  if (!items.length) {
    PANEL_STATE.keywordResults.innerHTML = "";
    return;
  }

  PANEL_STATE.keywordResults.innerHTML = items
    .map(({ keyword, audit, liveRank, tracking }) => {
      const titleGood = audit.counts.titleKeywordMentions === 1;
      const titleMessage =
        audit.titlePlacement?.message ||
        (titleGood
          ? "The title mentions this keyword exactly once."
          : audit.counts.titleKeywordMentions === 0
            ? "The title does not mention this keyword."
            : "The title repeats this keyword too often.");
      const descriptionGood = audit.descriptionPlacement?.status === "good";
      const rankText =
        liveRank.status === "ranked"
          ? `Page ${liveRank.resultPage}, position ${liveRank.pagePosition}`
          : "Outside the first 3 pages. Average position >73.";
      const showTrophy =
        liveRank.status === "ranked" &&
        liveRank.resultPage === 1 &&
        typeof liveRank.pagePosition === "number" &&
        liveRank.pagePosition >= 1 &&
        liveRank.pagePosition <= 3;
      const rankMessage = `Current rank: ${rankText}${
        showTrophy
          ? ' <span class="knowlense-rank-trophy" aria-label="Top 3 result" title="Top 3 result"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 5.5h8v2.2c0 2.8-1.8 5.2-4.4 6.1V16h2.8a1 1 0 0 1 1 1V18H8.6v-1a1 1 0 0 1 1-1h2.8v-2.2C9.8 12.9 8 10.5 8 7.7V5.5Z" fill="currentColor"></path><path d="M16 6h2.2a.8.8 0 0 1 .8.8c0 2.4-1.3 4.2-3.4 4.9M8 6H5.8a.8.8 0 0 0-.8.8c0 2.4 1.3 4.2 3.4 4.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path><path d="M9.4 20h5.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path></svg></span>'
          : ""
      }`;
      const suggestions = audit.relatedSuggestions?.length
        ? audit.relatedSuggestions.map((item) => `<span class="knowlense-chip">${item}</span>`).join("")
        : '<span class="knowlense-chip">No related keyword suggestions are available right now.</span>';
      const trackingMeta = tracking?.id
        ? `Tracking active since ${new Date(tracking.startedAt).toLocaleDateString()}.`
        : "Tracking is off.";

      return `
        <div class="knowlense-keyword-card">
          <div class="knowlense-keyword-card-head">
            <div class="knowlense-keyword-name">${keyword}</div>
            <div class="knowlense-keyword-score">${audit.seoScore}/100</div>
          </div>
          <div class="knowlense-check-list">
            ${buildKeywordCheck(rankMessage, liveRank.status === "ranked")}
            ${buildKeywordCheck(
              titleMessage,
              titleGood
            )}
            ${buildKeywordCheck(
              descriptionGood
                ? audit.descriptionPlacement.message
                : audit.descriptionPlacement?.message ||
                  "The description is not optimized near the start for this keyword.",
              descriptionGood
            )}
          </div>
          <div class="knowlense-suggestion-block">
            <div class="knowlense-suggestion-label">Related keyword suggestions</div>
            <div class="knowlense-chip-list">${suggestions}</div>
          </div>
          <div class="knowlense-track-toggle">
            <label class="knowlense-track-toggle-label">
              <input
                type="checkbox"
                data-track-keyword="${keyword}"
                ${tracking?.id ? "checked" : ""}
                ${tracking?.id ? `data-target-id="${tracking.id}"` : ""}
              />
              <span>Track this keyword</span>
            </label>
            <div class="knowlense-track-toggle-meta">${trackingMeta}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderSeoHealthResult(analysis) {
  if (!PANEL_STATE.healthResults) {
    return;
  }

  if (!analysis?.health) {
    PANEL_STATE.healthResults.innerHTML = "";
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

async function runKeywordAudit() {
  const extracted = extractProductSnapshot();
  if (!extracted.ok) {
    throw new Error(extracted.error);
  }

  const sessionState = await requireConnectedExtensionSession("Keyword SEO");

  const parsed = parseKeywordInput(
    PANEL_STATE.keywordInput?.value ?? "",
    extracted.snapshot.title,
    isPremiumSession(sessionState.session) ? 3 : 1
  );
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const baseUrl = sessionState.apiUrl.replace(/\/$/, "");
  const requests = parsed.keywords.map(async (keyword) => {
    const searchScan = await scanKeywordSearch(extracted.snapshot.productUrl, keyword);
    const localDescription = analyzeDescriptionPlacement(extracted.snapshot.descriptionExcerpt, keyword);
    const { descriptionExcerpt, ...snapshotForApi } = extracted.snapshot;
    const response = await fetch(`${baseUrl}/v1/product-seo-audit/analyze`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionState.session.sessionToken}`,
        "Content-Type": "application/json"
      },
        body: JSON.stringify({
          ...snapshotForApi,
          auditKeyword: keyword,
          serpTitles: searchScan.serpTitles,
          liveRank: {
            status: searchScan.rank.status,
            resultPage: searchScan.rank.resultPage,
            pagePosition: searchScan.rank.pagePosition
          },
          descriptionAudit: {
            mentionCount: localDescription.mentionCount,
            status: localDescription.status,
            containsKeyword: localDescription.containsKeyword,
            overused: localDescription.overused,
            message: localDescription.message
          }
        })
      });

    const payload = await response.json().catch(() => null);

    if (response.status === 401) {
      await chrome.storage.local.remove("knowlense_extension_session");
      throw new Error("Your extension session expired. Reconnect it from the website and try again.");
    }

    if (!response.ok || !payload?.analysis?.audit) {
      throw new Error(payload?.error || `Knowlense could not analyze "${keyword}".`);
    }

    const mergedAudit = {
      ...payload.analysis.audit,
      descriptionPlacement: {
        mentionCount: localDescription.mentionCount,
        status: localDescription.status,
        message: localDescription.message
      },
      checks: {
        ...payload.analysis.audit.checks,
        descriptionContainsKeyword: localDescription.containsKeyword,
        descriptionKeywordOverused: localDescription.overused
      },
        counts: {
          ...payload.analysis.audit.counts,
          descriptionKeywordMentions: localDescription.mentionCount
        }
      };

    return {
      keyword,
      liveRank: searchScan.rank,
      audit: mergedAudit
    };
  });
  const results = await Promise.all(requests);
  const trackedMap = await fetchTrackedKeywordTargets(baseUrl, sessionState.session.sessionToken, extracted.snapshot);
  const enrichedResults = results.map((result) => ({
    ...result,
    tracking: trackedMap.get(normalizeText(result.keyword)) || null
  }));

  return { results: enrichedResults, snapshot: extracted.snapshot, session: sessionState.session };
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
  bubble.setAttribute("aria-label", "Open Knowlense product tools");
  bubble.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.8" y="3.8" width="16.4" height="16.4" rx="4.8" stroke="currentColor" stroke-width="1.9"></rect>
      <path d="M7.4 15.8 10.55 12.65 12.9 15 16.55 10.9" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M14.95 10.9h2v2" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"></path>
      <circle cx="7.4" cy="15.8" r="1.1" fill="currentColor"></circle>
      <circle cx="10.55" cy="12.65" r="1.1" fill="currentColor"></circle>
      <circle cx="12.9" cy="15" r="1.1" fill="currentColor"></circle>
      <circle cx="16.55" cy="10.9" r="1.1" fill="currentColor"></circle>
    </svg>
  `;

  const panel = document.createElement("aside");
  panel.id = PANEL_ID;
  panel.hidden = true;
  panel.innerHTML = `
    <div class="knowlense-shell">
      <div class="knowlense-header">
        <div class="knowlense-badge">Knowlense</div>
        <h3 class="knowlense-title">Product Analysis</h3>
      </div>
      <div class="knowlense-body">
        <div class="knowlense-product-meta">
          <div>
            <div class="knowlense-meta-label">Product</div>
            <div class="knowlense-meta-value">${meta.title}</div>
          </div>
        </div>
        <div class="knowlense-tabs" role="tablist" aria-label="Knowlense product tabs">
          <button class="knowlense-tab is-active" type="button" data-tab="keyword-seo" role="tab" aria-selected="true">Keyword SEO</button>
            <button class="knowlense-tab" type="button" data-tab="criteria-seo" role="tab" aria-selected="false">SEO Health</button>
          <button class="knowlense-tab" type="button" data-tab="opportunity-finder" role="tab" aria-selected="false">Search Indexing</button>
        </div>
        <div class="knowlense-tab-panel is-active" data-panel="keyword-seo">
          <h4 class="knowlense-panel-heading">Keyword SEO Audit</h4>
          <label class="knowlense-input-label" for="knowlense-keyword-input">Target keywords</label>
          <textarea
            id="knowlense-keyword-input"
            class="knowlense-keyword-input"
            rows="3"
            placeholder="Enter up to 3 keywords, separated by commas"
          ></textarea>
          <div class="knowlense-keyword-help">Use up to 3 concise keywords. Separate them with commas.</div>
          <div class="knowlense-keyword-error"></div>
          <button class="knowlense-keyword-action" type="button">Run keyword audit</button>
          <div class="knowlense-keyword-status">Check rank, title placement, description placement, and related keyword suggestions.</div>
          <div class="knowlense-keyword-results"></div>
        </div>
        <div class="knowlense-tab-panel" data-panel="criteria-seo">
          <h4 class="knowlense-panel-heading">SEO Health Audit</h4>
          <p class="knowlense-panel-copy">Review the full product page against the main TPT product SEO criteria.</p>
          <button class="knowlense-keyword-action knowlense-health-action" type="button">Run SEO Health</button>
          <div class="knowlense-keyword-status knowlense-health-status">Check the full product quality, metadata, media, description, reviews, and store signals.</div>
          <div class="knowlense-health-results"></div>
        </div>
        <div class="knowlense-tab-panel" data-panel="opportunity-finder">
          <h4 class="knowlense-panel-heading">Search Indexing</h4>
          <p class="knowlense-panel-copy">Check whether this product currently appears on major search engines using URL-based indexing checks.</p>
          <button class="knowlense-keyword-action knowlense-indexing-action" type="button">Check search indexing</button>
          <div class="knowlense-keyword-status knowlense-indexing-status">Review current indexing visibility across major search engines.</div>
          <div class="knowlense-indexing-results"></div>
        </div>
      </div>
    </div>
  `;

  mountRoot.appendChild(bubble);
  mountRoot.appendChild(panel);

  bubble.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
  });

  panel.querySelectorAll(".knowlense-tab").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.getAttribute("data-tab"));
    });
  });

  PANEL_STATE.bubble = bubble;
  PANEL_STATE.panel = panel;
  PANEL_STATE.keywordInput = panel.querySelector(".knowlense-keyword-input");
  PANEL_STATE.keywordAction = panel.querySelector(".knowlense-keyword-action");
  PANEL_STATE.keywordError = panel.querySelector(".knowlense-keyword-error");
  PANEL_STATE.keywordStatus = panel.querySelector(".knowlense-keyword-status");
  PANEL_STATE.keywordResults = panel.querySelector(".knowlense-keyword-results");
  PANEL_STATE.healthAction = panel.querySelector(".knowlense-health-action");
  PANEL_STATE.healthStatus = panel.querySelector(".knowlense-health-status");
  PANEL_STATE.healthResults = panel.querySelector(".knowlense-health-results");
  PANEL_STATE.indexingAction = panel.querySelector(".knowlense-indexing-action");
  PANEL_STATE.indexingStatus = panel.querySelector(".knowlense-indexing-status");
  PANEL_STATE.indexingResults = panel.querySelector(".knowlense-indexing-results");
  PANEL_STATE.productMetaValue = panel.querySelector(".knowlense-meta-value");
  setActiveTab(PANEL_STATE.activeTab);
  refreshMountedProductMeta();
  refreshPanelConnectionState();

  PANEL_STATE.keywordAction?.addEventListener("click", async () => {
    setKeywordError("");
    renderKeywordResults([]);
    PANEL_STATE.keywordAction.disabled = true;
    PANEL_STATE.keywordAction.textContent = "Analyzing...";
    setKeywordStatus("Running audits for the current keywords...");

    try {
      const { results, snapshot, session } = await runKeywordAudit();
      renderKeywordResults(results);
      bindKeywordTrackingToggles(results, snapshot, session);
      setKeywordStatus(`Audit complete for ${results.length} keyword${results.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setKeywordError(error instanceof Error ? error.message : "Knowlense could not run the keyword audit.");
      setKeywordStatus("Fix the issue above and try again.");
    } finally {
      PANEL_STATE.keywordAction.disabled = false;
      PANEL_STATE.keywordAction.textContent = "Run keyword audit";
    }
  });

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

  PANEL_STATE.indexingAction?.addEventListener("click", async () => {
    renderSearchIndexingResult(null);
    PANEL_STATE.indexingAction.disabled = true;
    PANEL_STATE.indexingAction.textContent = "Checking...";
    setIndexingStatus("Checking this product across major search engines...");

    try {
      const result = await runSearchIndexingAudit();
      renderSearchIndexingResult(result);
      setIndexingStatus(`Search indexing check completed for ${result.checks.length} search engine${result.checks.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setIndexingStatus(error instanceof Error ? error.message : "Knowlense could not run the search indexing check.", "error");
    } finally {
      PANEL_STATE.indexingAction.disabled = false;
      PANEL_STATE.indexingAction.textContent = "Check search indexing";
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

  PANEL_STATE.keywordInput = null;
  PANEL_STATE.keywordAction = null;
  PANEL_STATE.keywordError = null;
  PANEL_STATE.keywordStatus = null;
  PANEL_STATE.keywordResults = null;
  PANEL_STATE.healthAction = null;
  PANEL_STATE.healthStatus = null;
  PANEL_STATE.healthResults = null;
  PANEL_STATE.indexingAction = null;
  PANEL_STATE.indexingStatus = null;
  PANEL_STATE.indexingResults = null;
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
void chrome.runtime.sendMessage({ type: "knowlense.rankTracking.wakeup" }).catch(() => null);
setInterval(() => {
  if (document.visibilityState !== "visible") {
    return;
  }
  mountProductPanel();
}, 5000);

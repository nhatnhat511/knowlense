export type SearchResultSnapshot = {
  position: number;
  title: string;
  productUrl?: string | null;
  shopName?: string | null;
  priceText?: string | null;
  snippet?: string | null;
};

export type SearchSnapshot = {
  query: string;
  pageUrl: string;
  capturedAt?: string;
  results: SearchResultSnapshot[];
};

type KeywordScore = {
  phrase: string;
  averagePosition: number;
  demandSignal: number;
  opportunityScore: number;
  frequency: number;
  modifierCount: number;
  saturationLevel: "low" | "medium" | "high";
  reason: string;
};

type Opportunity = {
  phrase: string;
  score: number;
  type: "adjacent" | "underserved";
  reason: string;
};

type AnalysisResult = {
  summary: {
    query: string;
    normalizedQuery: string;
    totalResults: number;
    capturedAt: string;
    dominantTerms: string[];
    adjacentModifiers: string[];
    saturatedPhrases: string[];
  };
  keywords: KeywordScore[];
  opportunities: Opportunity[];
};

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
  "your"
]);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularize(token: string) {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) {
    return token.slice(0, -1);
  }

  return token;
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .map((token) => singularize(token.trim()))
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function buildPhrases(tokens: string[]) {
  const phrases = new Set<string>();

  for (let index = 0; index < tokens.length; index += 1) {
    for (let size = 1; size <= 3; size += 1) {
      const slice = tokens.slice(index, index + size);
      if (slice.length !== size) {
        continue;
      }

      phrases.add(slice.join(" "));
    }
  }

  return [...phrases];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function createReason(frequency: number, modifierCount: number, saturationLevel: string, averagePosition: number) {
  const parts = [`appears in ${frequency} result${frequency === 1 ? "" : "s"}`];

  if (modifierCount > 0) {
    parts.push("contains useful modifiers beyond the base query");
  }

  if (averagePosition <= 5) {
    parts.push("shows up high in the observed ranking");
  }

  if (saturationLevel === "high") {
    parts.push("but the page is already crowded with similar phrasing");
  }

  return parts.join(", ");
}

export function analyzeKeywordSnapshot(snapshot: SearchSnapshot): AnalysisResult {
  const queryTokens = tokenize(snapshot.query);
  const queryTokenSet = new Set(queryTokens);
  const phraseMap = new Map<string, { count: number; positions: number[]; tokenCount: number; modifierCount: number }>();
  const tokenFrequency = new Map<string, number>();
  const modifierFrequency = new Map<string, number>();
  const totalResults = snapshot.results.length;

  snapshot.results.forEach((result, index) => {
    const combinedText = `${result.title} ${result.snippet ?? ""}`;
    const tokens = tokenize(combinedText);
    const phrases = buildPhrases(tokens);

    new Set(tokens).forEach((token) => {
      tokenFrequency.set(token, (tokenFrequency.get(token) ?? 0) + 1);
      if (!queryTokenSet.has(token)) {
        modifierFrequency.set(token, (modifierFrequency.get(token) ?? 0) + 1);
      }
    });

    phrases.forEach((phrase) => {
      const phraseTokens = phrase.split(" ");
      const modifierCount = phraseTokens.filter((token) => !queryTokenSet.has(token)).length;
      const current = phraseMap.get(phrase);

      if (!current) {
        phraseMap.set(phrase, {
          count: 1,
          positions: [result.position || index + 1],
          tokenCount: phraseTokens.length,
          modifierCount
        });
        return;
      }

      current.count += 1;
      current.positions.push(result.position || index + 1);
    });
  });

  const keywords = [...phraseMap.entries()]
    .filter(([phrase, value]) => {
      if (value.count < 2) {
        return false;
      }

      if (phrase.length < 4) {
        return false;
      }

      return phrase !== queryTokens.join(" ");
    })
    .map(([phrase, value]) => {
      const averagePosition = value.positions.reduce((sum, item) => sum + item, 0) / value.positions.length;
      const frequencyRatio = totalResults > 0 ? value.count / totalResults : 0;
      const saturationLevel = frequencyRatio >= 0.5 ? "high" : frequencyRatio >= 0.3 ? "medium" : "low";
      const demandSignal = Math.round(clamp(value.count * 9 + (12 - averagePosition), 0, 45));
      const specificityBonus = value.tokenCount === 1 ? 0 : value.tokenCount === 2 ? 8 : 14;
      const adjacencyBonus = value.modifierCount > 0 ? 12 : 0;
      const saturationPenalty = saturationLevel === "high" ? 18 : saturationLevel === "medium" ? 8 : 0;
      const opportunityScore = Math.round(clamp(demandSignal + specificityBonus + adjacencyBonus - saturationPenalty, 0, 100));

      return {
        phrase,
        averagePosition: Number(averagePosition.toFixed(1)),
        demandSignal,
        opportunityScore,
        frequency: value.count,
        modifierCount: value.modifierCount,
        saturationLevel,
        reason: createReason(value.count, value.modifierCount, saturationLevel, averagePosition)
      } satisfies KeywordScore;
    })
    .sort((left, right) => right.opportunityScore - left.opportunityScore || right.frequency - left.frequency)
    .slice(0, 12);

  const dominantTerms = [...tokenFrequency.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([token]) => token);

  const adjacentModifiers = [...modifierFrequency.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([token]) => token);

  const saturatedPhrases = keywords
    .filter((keyword) => keyword.saturationLevel === "high")
    .slice(0, 4)
    .map((keyword) => keyword.phrase);

  const opportunities = keywords
    .filter((keyword) => keyword.modifierCount > 0 || keyword.saturationLevel === "low")
    .slice(0, 6)
    .map((keyword) => ({
      phrase: keyword.phrase,
      score: keyword.opportunityScore,
      type: keyword.modifierCount > 0 ? "adjacent" : "underserved",
      reason:
        keyword.modifierCount > 0
          ? "Includes modifiers missing from the base query, which can support adjacent product angles."
          : "Shows repeated demand without the strongest saturation pattern on the page."
    })) satisfies Opportunity[];

  return {
    summary: {
      query: snapshot.query,
      normalizedQuery: queryTokens.join(" "),
      totalResults,
      capturedAt: snapshot.capturedAt ?? new Date().toISOString(),
      dominantTerms,
      adjacentModifiers,
      saturatedPhrases
    },
    keywords,
    opportunities
  };
}

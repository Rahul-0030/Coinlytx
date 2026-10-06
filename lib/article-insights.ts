/* =========================================================
   COINLYTX — AUTOMATIC ARTICLE KEY INSIGHTS
   Creates exactly 3 insights from WordPress article content.
========================================================= */

function decodeHtml(value: string = "") {
  return value
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function cleanText(value: string = "") {
  return decodeHtml(
    value
      /* Remove scripts/styles completely */
      .replace(
        /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi,
        " "
      )

      /* Create sentence boundaries around blocks */
      .replace(
        /<\/?(p|div|h1|h2|h3|h4|li|blockquote)[^>]*>/gi,
        ". "
      )

      /* Remove remaining HTML */
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .replace(/\.+/g, ".")
    .trim();
}


/* =========================================================
   SPLIT CONTENT INTO SENTENCES
========================================================= */

function getSentences(content: string) {
  const text = cleanText(content);

  if (!text) return [];

  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) =>
      sentence
        .replace(/^[.\s]+/, "")
        .trim()
    )
    .filter((sentence) => {
      const words =
        sentence.split(/\s+/).length;

      /*
       * Avoid tiny fragments/headings and extremely
       * long malformed sentences.
       */

      return (
        sentence.length >= 45 &&
        sentence.length <= 260 &&
        words >= 8
      );
    });
}


/* =========================================================
   SHORTEN AN INSIGHT
========================================================= */

function shortenInsight(
  sentence: string,
  maxLength: number = 155
) {
  const cleaned = sentence.trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const shortened =
    cleaned.slice(0, maxLength);

  const lastSpace =
    shortened.lastIndexOf(" ");

  if (lastSpace === -1) {
    return `${shortened}…`;
  }

  return `${shortened
    .slice(0, lastSpace)
    .trim()}…`;
}


/* =========================================================
   REMOVE DUPLICATE / VERY SIMILAR SENTENCES
========================================================= */

function normalizeForComparison(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isTooSimilar(
  candidate: string,
  selected: string[]
) {
  const candidateWords = new Set(
    normalizeForComparison(candidate)
      .split(" ")
      .filter((word) => word.length > 3)
  );

  if (!candidateWords.size) {
    return true;
  }

  return selected.some((item) => {
    const selectedWords = new Set(
      normalizeForComparison(item)
        .split(" ")
        .filter((word) => word.length > 3)
    );

    let commonWords = 0;

    candidateWords.forEach((word) => {
      if (selectedWords.has(word)) {
        commonWords++;
      }
    });

    const similarity =
      commonWords /
      Math.min(
        candidateWords.size,
        selectedWords.size || 1
      );

    return similarity > 0.65;
  });
}


/* =========================================================
   CREATE EXACTLY UP TO 3 KEY INSIGHTS
========================================================= */

export function generateArticleInsights(
  contentHtml: string,
  excerptHtml: string = ""
): string[] {
  /*
   * Excerpt is useful because WordPress editors often
   * put the main takeaway there.
   */

  const excerptSentences =
    getSentences(excerptHtml);

  const contentSentences =
    getSentences(contentHtml);

  const candidates = [
    ...excerptSentences,
    ...contentSentences,
  ];

  const insights: string[] = [];

  for (const sentence of candidates) {
    const insight =
      shortenInsight(sentence);

    if (
      !isTooSimilar(
        insight,
        insights
      )
    ) {
      insights.push(insight);
    }

    if (insights.length === 3) {
      break;
    }
  }

  return insights;
}
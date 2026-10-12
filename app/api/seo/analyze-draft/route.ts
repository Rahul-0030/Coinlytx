import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = "https://coinlytx.com";
const SITE_NAME = "Coinlytx";

const STOP_WORDS = new Set([
  "a","an","and","are","as","at","be","been","being","but","by","can","could",
  "did","do","does","for","from","had","has","have","how","if","in","into","is",
  "it","its","may","more","most","of","on","or","our","should","than","that","the",
  "their","there","these","they","this","to","was","were","what","when","where",
  "which","who","why","will","with","would","you","your"
]);

const GENERIC_WORDS = new Set([
  "news","latest","today","update","updates","new","best","top","guide","market",
  "markets","crypto","cryptocurrency","digital","business","global","article"
]);

const AIISH_PHRASES = [
  "in today's digital landscape",
  "in the ever-evolving",
  "ever-evolving landscape",
  "delve into",
  "unlock the power",
  "game-changer",
  "game changer",
  "revolutionize",
  "in conclusion",
  "this article explores",
  "this article delves",
  "seamlessly",
  "robust solution",
  "leverage the power",
  "navigate the complexities",
  "realm of",
  "it is important to note",
  "it's important to note",
  "furthermore",
  "moreover",
];

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return decodeHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length >= 3 &&
        !STOP_WORDS.has(word)
    );
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countPhrase(text: string, phrase: string) {
  const clean = phrase.trim();

  if (!clean) return 0;

  const regex = new RegExp(
    `\\b${escapeRegex(clean).replace(/\s+/g, "\\s+")}\\b`,
    "gi"
  );

  return (text.match(regex) || []).length;
}

function wordCount(text: string) {
  const clean = text.trim();
  return clean ? clean.split(/\s+/).filter(Boolean).length : 0;
}

function truncateAtWord(value: string, max: number) {
  const clean = value.replace(/\s+/g, " ").trim();

  if (clean.length <= max) return clean;

  const cut = clean.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");

  return `${cut.slice(0, lastSpace > 25 ? lastSpace : max).trim()}…`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sentenceSplit(text: string) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function extractHeadings(html: string, tag: string) {
  const regex = new RegExp(
    `<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
    "gi"
  );

  const results: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    results.push(stripHtml(match[1] || ""));
  }

  return results;
}

function extractLinks(html: string) {
  const regex =
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;

  let internalCount = 0;
  let externalCount = 0;
  const externalHosts: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const href = (match[1] || "").trim();

    if (!href) continue;

    try {
      const url = new URL(href, SITE_URL);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");

      if (
        host === "coinlytx.com" ||
        host === "cms.coinlytx.com"
      ) {
        internalCount += 1;
      } else if (url.protocol === "http:" || url.protocol === "https:") {
        externalCount += 1;
        externalHosts.push(host);
      }
    } catch {}
  }

  return {
    internalCount,
    externalCount,
    externalHosts: unique(externalHosts),
  };
}

function extractImages(html: string) {
  const regex = /<img\b[^>]*>/gi;
  const tags = html.match(regex) || [];

  let missingAlt = 0;

  for (const tag of tags) {
    const alt = tag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";

    if (!alt.trim()) {
      missingAlt += 1;
    }
  }

  return {
    total: tags.length,
    missingAlt,
  };
}

function extractNgrams(
  title: string,
  headings: string[],
  text: string
) {
  const titleTokens = tokenize(title);
  const headingTokens = tokenize(headings.join(" "));
  const bodyTokens = tokenize(text);

  const score = new Map<string, number>();

  function addNgrams(
    tokens: string[],
    size: number,
    weight: number,
    maxWindows = 5000
  ) {
    const windows = Math.min(
      Math.max(0, tokens.length - size + 1),
      maxWindows
    );

    for (let i = 0; i < windows; i += 1) {
      const words = tokens.slice(i, i + size);

      if (
        words.some((word) => STOP_WORDS.has(word)) ||
        words.every((word) => GENERIC_WORDS.has(word))
      ) {
        continue;
      }

      const phrase = words.join(" ");

      score.set(
        phrase,
        (score.get(phrase) || 0) + weight
      );
    }
  }

  for (const size of [2, 3, 4]) {
    addNgrams(titleTokens, size, 14 - size);
    addNgrams(headingTokens, size, 7 - size);
    addNgrams(bodyTokens, size, 1.2);
  }

  for (const token of unique(titleTokens)) {
    if (!GENERIC_WORDS.has(token) && token.length >= 5) {
      score.set(token, (score.get(token) || 0) + 5);
    }
  }

  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase);
}

function pickFocusKeyword(
  existing: string,
  candidates: string[],
  title: string,
  text: string
) {
  const cleanExisting = existing.trim();

  if (cleanExisting) {
    const uses = countPhrase(
      `${title} ${text}`,
      cleanExisting
    );

    if (uses >= 1) {
      return cleanExisting;
    }
  }

  const titleLower = title.toLowerCase();

  const preferred =
    candidates.find(
      (candidate) =>
        candidate.split(" ").length >= 2 &&
        titleLower.includes(candidate.toLowerCase())
    ) ||
    candidates.find(
      (candidate) => candidate.split(" ").length >= 2
    ) ||
    candidates[0] ||
    title;

  return preferred.trim();
}

function detectIntent(title: string, text: string) {
  const haystack = `${title} ${text.slice(0, 800)}`.toLowerCase();

  if (
    /\b(review|reviews|best|top|vs|versus|comparison|compare)\b/.test(
      haystack
    )
  ) {
    return {
      type: "commercial",
      label: "Commercial investigation",
    };
  }

  if (
    /\b(buy|price|discount|coupon|where to buy|sign up|download)\b/.test(
      haystack
    )
  ) {
    return {
      type: "transactional",
      label: "Transactional",
    };
  }

  if (
    /\b(announces|announced|launches|launched|raises|raised|reports|reported|breaking|latest|today|surges|falls|rises|drops|sec|fed|court)\b/.test(
      haystack
    )
  ) {
    return {
      type: "news",
      label: "News / current event",
    };
  }

  if (
    /\b(how|what|why|guide|explained|learn|understand|meaning|works)\b/.test(
      haystack
    )
  ) {
    return {
      type: "informational",
      label: "Informational",
    };
  }

  return {
    type: "informational",
    label: "Informational / editorial",
  };
}

function cleanHeadline(title: string) {
  return title
    .replace(/\s+/g, " ")
    .replace(/\s+([?!,:;.])/g, "$1")
    .replace(/\bFor an AI-Powered Growth\b/i, "for AI-Powered Growth")
    .replace(/\bFor a\b/g, "for a")
    .replace(/\bFor an\b/g, "for an")
    .trim();
}

function buildSeoTitleSuggestions(
  title: string,
  focusKeyword: string,
  intent: string
) {
  const cleaned = cleanHeadline(title);

  const options: string[] = [];

  if (cleaned.length >= 35 && cleaned.length <= 65) {
    options.push(cleaned);
  } else {
    options.push(truncateAtWord(cleaned, 60));
  }

  if (focusKeyword) {
    const titleHasKeyword = cleaned
      .toLowerCase()
      .includes(focusKeyword.toLowerCase());

    if (!titleHasKeyword) {
      options.push(
        truncateAtWord(
          `${focusKeyword}: ${cleaned}`,
          60
        )
      );
    }
  }

  if (intent === "informational" && focusKeyword) {
    options.push(
      truncateAtWord(
        `${focusKeyword}: What You Need to Know`,
        60
      )
    );
  }

  if (intent === "news" && focusKeyword) {
    options.push(
      truncateAtWord(
        `${cleaned} | ${SITE_NAME}`,
        60
      )
    );
  }

  return unique(
    options
      .map((item) => item.trim())
      .filter((item) => item.length >= 25)
  ).slice(0, 3);
}

function buildMetaSuggestions(
  excerpt: string,
  text: string,
  focusKeyword: string
) {
  const sentences = sentenceSplit(
    excerpt.trim() || text
  );

  const keywordLower = focusKeyword.toLowerCase();

  const keywordSentence =
    sentences.find(
      (sentence) =>
        focusKeyword &&
        sentence.toLowerCase().includes(keywordLower) &&
        sentence.length >= 70
    ) ||
    sentences.find((sentence) => sentence.length >= 85) ||
    sentences[0] ||
    "";

  const first = truncateAtWord(keywordSentence, 155);

  const secondBase = [
    sentences[0],
    sentences[1],
  ]
    .filter(Boolean)
    .join(" ");

  const second = truncateAtWord(
    secondBase || keywordSentence,
    155
  );

  return unique(
    [first, second]
      .map((item) =>
        item
          .replace(
            /^(in this article|this article explores|this article delves into)\s*/i,
            ""
          )
          .trim()
      )
      .filter((item) => item.length >= 70)
  ).slice(0, 2);
}

function findAiishPhrases(text: string) {
  const lower = text.toLowerCase();

  return AIISH_PHRASES.filter((phrase) =>
    lower.includes(phrase)
  );
}

function scoreRange(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function schemaTypeFor(
  intent: string,
  title: string
) {
  if (intent === "news") {
    return "NewsArticle";
  }

  if (/\b(review|reviewed)\b/i.test(title)) {
    return "Article";
  }

  return "Article";
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "analyze-draft",
    version: "4.0",
    message:
      "Coinlytx advanced on-page SEO analyzer is active.",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const title = String(body.title || "").trim();
    const slug = String(body.slug || "").trim();
    const html = String(body.content || "");
    const excerpt = String(body.excerpt || "").trim();
    const existingFocusKeyword = String(
      body.focusKeyword || ""
    ).trim();
    const currentSeoTitle = String(
      body.seoTitle || ""
    ).trim();
    const currentMetaDescription = String(
      body.metaDescription || ""
    ).trim();
    const currentCanonical = String(
      body.canonicalUrl || ""
    ).trim();
    const featuredImageUrl = String(
      body.featuredImageUrl || ""
    ).trim();
    const featuredImageAlt = String(
      body.featuredImageAlt || ""
    ).trim();
    const status = String(body.status || "");
    const publishedAt = String(body.publishedAt || "");

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error: "Article title is required.",
        },
        {
          status: 400,
        }
      );
    }

    const text = stripHtml(html);
    const words = wordCount(text);

    const h1 = extractHeadings(html, "h1");
    const h2 = extractHeadings(html, "h2");
    const h3 = extractHeadings(html, "h3");
    const links = extractLinks(html);
    const images = extractImages(html);

    const phraseCandidates = extractNgrams(
      title,
      [...h2, ...h3],
      text
    );

    const focusKeyword = pickFocusKeyword(
      existingFocusKeyword,
      phraseCandidates,
      title,
      text
    );

    const focusCount = countPhrase(
      `${title} ${text}`,
      focusKeyword
    );

    const keywordWordCount =
      Math.max(1, focusKeyword.split(/\s+/).length);

    const keywordDensity =
      words > 0
        ? Number(
            (
              ((focusCount * keywordWordCount) /
                words) *
              100
            ).toFixed(2)
          )
        : 0;

    const intent = detectIntent(title, text);

    const titleSuggestions =
      buildSeoTitleSuggestions(
        title,
        focusKeyword,
        intent.type
      );

    const metaSuggestions =
      buildMetaSuggestions(
        excerpt,
        text,
        focusKeyword
      );

    const canonicalSuggestion = slug
      ? `${SITE_URL}/${slug.replace(/^\/+|\/+$/g, "")}`
      : SITE_URL;

    const suggestedSlug = slugify(
      focusKeyword.split(" ").length >= 2
        ? focusKeyword
        : title
    );

    const secondaryKeywords = unique(
      phraseCandidates
        .filter(
          (phrase) =>
            phrase.toLowerCase() !==
            focusKeyword.toLowerCase()
        )
        .filter(
          (phrase) =>
            phrase.split(" ").length >= 2
        )
    ).slice(0, 8);

    const aiishPhrases = findAiishPhrases(text);

    const criticalIssues: string[] = [];
    const improvements: string[] = [];
    const passedChecks: string[] = [];
    const priorityActions: string[] = [];

    if (words < 300) {
      criticalIssues.push(
        "Content is very thin. Expand the article only if more original reporting, context, evidence or useful explanation is available."
      );
      priorityActions.push(
        "Add original value before publishing; avoid padding the article just to increase word count."
      );
    } else {
      passedChecks.push(
        `Article has ${words.toLocaleString()} words.`
      );
    }

    if (!slug) {
      criticalIssues.push("Slug is missing.");
      priorityActions.push("Create a descriptive, stable URL slug.");
    } else {
      passedChecks.push("URL slug is present.");
    }

    if (!featuredImageUrl) {
      improvements.push(
        "Featured image is missing. News and Discover visibility benefit from strong, relevant imagery."
      );
    } else {
      passedChecks.push("Featured image is present.");
    }

    if (
      featuredImageUrl &&
      !featuredImageAlt
    ) {
      improvements.push(
        "Featured image alt text is missing. Write a factual description of what the image shows; do not stuff keywords."
      );
    } else if (featuredImageAlt) {
      passedChecks.push(
        "Featured image has alt text."
      );
    }

    if (h1.length > 0) {
      improvements.push(
        "Article body contains an H1. Keep one visible page H1 and use H2/H3 inside the article body."
      );
    }

    if (words >= 600 && h2.length === 0) {
      improvements.push(
        "Long-form content has no H2 structure. Add descriptive sections where they genuinely improve scanning."
      );
    } else if (h2.length > 0) {
      passedChecks.push(
        `${h2.length} H2 section${h2.length === 1 ? "" : "s"} found.`
      );
    }

    const expectedInternal =
      words >= 1200 ? 3 : words >= 600 ? 2 : 1;

    if (links.internalCount < expectedInternal) {
      improvements.push(
        `Only ${links.internalCount} internal link${links.internalCount === 1 ? "" : "s"} found. Aim for at least ${expectedInternal} genuinely useful contextual links for an article of this length.`
      );
    } else {
      passedChecks.push(
        `${links.internalCount} contextual internal link${links.internalCount === 1 ? "" : "s"} found.`
      );
    }

    if (
      intent.type === "news" &&
      links.externalCount === 0
    ) {
      improvements.push(
        "No external source links were found. For reported news, cite the primary announcement, filing, dataset, regulator, company statement or other authoritative source when available."
      );
    } else if (links.externalCount > 0) {
      passedChecks.push(
        `${links.externalCount} external source link${links.externalCount === 1 ? "" : "s"} found.`
      );
    }

    if (images.missingAlt > 0) {
      improvements.push(
        `${images.missingAlt} in-article image${images.missingAlt === 1 ? "" : "s"} lack alt text. Add useful alt text only when the image conveys information.`
      );
    }

    if (focusKeyword) {
      if (focusCount === 0) {
        improvements.push(
          `Suggested focus topic "${focusKeyword}" is not stated clearly in the article. Use it naturally if it accurately describes the page.`
        );
      } else {
        passedChecks.push(
          `Focus topic appears ${focusCount} time${focusCount === 1 ? "" : "s"}.`
        );
      }

      if (keywordDensity > 2.5 && focusCount >= 6) {
        improvements.push(
          "The exact focus phrase may be repeated too often. Rewrite repetitions naturally; keyword density is not a ranking target."
        );
      }
    }

    if (
      currentSeoTitle &&
      (currentSeoTitle.length < 30 ||
        currentSeoTitle.length > 65)
    ) {
      improvements.push(
        "Current SEO title is unusually short or long. Google can rewrite title links, so prioritize a concise, descriptive title rather than chasing an exact character count."
      );
    }

    if (
      currentMetaDescription &&
      (currentMetaDescription.length < 90 ||
        currentMetaDescription.length > 170)
    ) {
      improvements.push(
        "Current meta description is unusually short or long. Write a useful summary; Google may choose a different snippet for a query."
      );
    }

    if (
      currentCanonical &&
      currentCanonical !== canonicalSuggestion
    ) {
      improvements.push(
        `Canonical differs from the preferred self-canonical URL (${canonicalSuggestion}). Verify this is intentional.`
      );
    } else if (slug) {
      passedChecks.push(
        "Canonical can point to the current Coinlytx URL."
      );
    }

    if (aiishPhrases.length > 0) {
      improvements.push(
        `Formulaic wording detected: ${aiishPhrases
          .slice(0, 5)
          .map((item) => `"${item}"`)
          .join(", ")}. Replace only where the wording sounds generic or adds no meaning.`
      );
      priorityActions.push(
        "Edit formulaic phrases into specific, evidence-based language that sounds like a newsroom writer."
      );
    } else {
      passedChecks.push(
        "No obvious formulaic AI-style filler phrases detected."
      );
    }

    const firstSentence =
      sentenceSplit(text)[0] || "";

    if (
      firstSentence.length > 260
    ) {
      improvements.push(
        "Opening sentence is long. Consider a tighter lead that tells readers the main development quickly."
      );
    }

    if (
      !/\b(according to|reported|data|filing|statement|research|study|said|told|announced)\b/i.test(
        text
      ) &&
      intent.type === "news"
    ) {
      improvements.push(
        "News article shows little obvious attribution language. Add clear sourcing where the reporting relies on claims, data or announcements."
      );
    }

    if (
      !currentSeoTitle ||
      !currentMetaDescription ||
      !existingFocusKeyword
    ) {
      priorityActions.push(
        "Review and apply the suggested focus keyword, SEO title and meta description before publishing."
      );
    }

    if (links.internalCount < expectedInternal) {
      priorityActions.push(
        "Add only contextually relevant internal links; avoid forcing unrelated anchors."
      );
    }

    if (
      intent.type === "news" &&
      links.externalCount === 0
    ) {
      priorityActions.push(
        "Add at least one primary/authoritative source link when the story is based on external reporting or an announcement."
      );
    }

    const contentScore =
      45 +
      Math.min(20, words / 60) +
      Math.min(10, h2.length * 3) +
      (aiishPhrases.length === 0 ? 10 : 0) +
      (links.externalCount > 0 ? 8 : 0);

    const internalScore = Math.min(
      100,
      (links.internalCount /
        Math.max(1, expectedInternal)) *
        100
    );

    const indexScore =
      (slug ? 25 : 0) +
      (title ? 20 : 0) +
      (featuredImageUrl ? 15 : 0) +
      (canonicalSuggestion ? 20 : 0) +
      (words >= 300 ? 20 : 0);

    const metadataScore =
      (currentSeoTitle || titleSuggestions[0] ? 25 : 0) +
      (currentMetaDescription || metaSuggestions[0] ? 25 : 0) +
      (focusKeyword ? 20 : 0) +
      (slug ? 15 : 0) +
      (featuredImageAlt || !featuredImageUrl ? 15 : 0);

    const seoScore = scoreRange(
      metadataScore * 0.35 +
        scoreRange(contentScore) * 0.35 +
        internalScore * 0.15 +
        indexScore * 0.15
    );

    const schemaType = schemaTypeFor(
      intent.type,
      title
    );

    const recommendedTitle =
      titleSuggestions[0] || title;

    const recommendedMeta =
      metaSuggestions[0] ||
      truncateAtWord(
        excerpt || firstSentence || title,
        155
      );

    const schema = {
      type: schemaType,
      alsoUse: ["BreadcrumbList"],
      conditional: [
        "FAQPage only when the page contains a genuine visible FAQ section; do not create FAQs solely for schema.",
      ],
      jsonLdPreview: {
        "@context": "https://schema.org",
        "@type": schemaType,
        headline: recommendedTitle,
        description: recommendedMeta,
        mainEntityOfPage: canonicalSuggestion,
        ...(featuredImageUrl
          ? {
              image: [featuredImageUrl],
            }
          : {}),
        ...(publishedAt
          ? {
              datePublished: publishedAt,
            }
          : {}),
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
          url: SITE_URL,
        },
      },
    };

    return NextResponse.json({
      success: true,
      route: "analyze-draft",
      version: "4.0",
      scores: {
        seo: seoScore,
        indexReadiness: scoreRange(indexScore),
        contentQuality: scoreRange(contentScore),
        internalLinks: scoreRange(internalScore),
      },
      article: {
        wordCount: words,
        headings: {
          h1,
          h2,
          h3,
        },
        links,
        images,
        keyword: {
          phrase: focusKeyword,
          count: focusCount,
          density: keywordDensity,
        },
        intent,
        status,
      },
      suggestions: {
        searchIntent: intent.label,
        focusKeyword,
        secondaryKeywords,
        seoTitles: titleSuggestions,
        metaDescriptions: metaSuggestions,
        slug: suggestedSlug,
        canonical: canonicalSuggestion,
        imageAlt:
          featuredImageAlt ||
          truncateAtWord(
            `${title} featured image`,
            120
          ),
        humanWriting: {
          formulaicPhrases: aiishPhrases,
          guidance:
            "Prefer specific facts, named entities, numbers, sourcing and plain editorial language. Avoid filler, exaggerated claims and repetitive keyword phrasing.",
        },
      },
      schema,
      checks: {
        criticalIssues,
        improvements,
        passedChecks,
      },
      priorityActions: unique(priorityActions).slice(0, 8),
      note:
        "These are editorial/on-page recommendations, not ranking guarantees. Search demand, SERP competition and query performance should be validated with Search Console or external keyword/SERP data.",
    });
  } catch (error) {
    console.error("Advanced SEO analysis error:", error);

    return NextResponse.json(
      {
        success: false,
        route: "analyze-draft",
        version: "4.0",
        error:
          error instanceof Error
            ? error.message
            : "Unable to analyze the article.",
      },
      {
        status: 500,
      }
    );
  }
}

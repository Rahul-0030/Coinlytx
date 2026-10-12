import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LinkItem = {
  url: string;
  anchor: string;
};

type ImageItem = {
  src: string;
  alt: string;
  missingAlt: boolean;
};

function decodeHtml(text: string) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#8211;/gi, "–")
    .replace(/&#8212;/gi, "—")
    .replace(/&#8216;/gi, "‘")
    .replace(/&#8217;/gi, "’")
    .replace(/&#8220;/gi, "“")
    .replace(/&#8221;/gi, "”")
    .replace(/&#8230;/gi, "…")
    .replace(/&#038;/gi, "&")
    .replace(/&#(\d+);/g, (_, code) => {
      try {
        return String.fromCharCode(Number(code));
      } catch {
        return "";
      }
    });
}

function stripTags(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function countWords(text: string) {
  const clean = text.trim();

  if (!clean) return 0;

  return clean
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

function getMetaContent(html: string, name: string) {
  const escaped = name.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
      "i"
    ),

    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return decodeHtml(match[1].trim());
    }
  }

  return "";
}

function getCanonical(html: string) {
  const patterns = [
    /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i,

    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function extractHeadings(
  html: string,
  level: 1 | 2 | 3
) {
  const regex = new RegExp(
    `<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`,
    "gi"
  );

  const headings: string[] = [];

  let match;

  while ((match = regex.exec(html)) !== null) {
    const heading = stripTags(match[1]);

    if (heading) {
      headings.push(heading);
    }
  }

  return headings;
}

function extractLinks(
  html: string,
  articleUrl: string
) {
  const internal: LinkItem[] = [];
  const external: LinkItem[] = [];

  const currentHost = new URL(articleUrl)
    .hostname
    .replace(/^www\./, "");

  const regex =
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const href = match[1]?.trim();

    if (!href) continue;

    if (
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    ) {
      continue;
    }

    try {
      const absolute = new URL(
        href,
        articleUrl
      );

      if (
        absolute.protocol !== "http:" &&
        absolute.protocol !== "https:"
      ) {
        continue;
      }

      const anchor =
        stripTags(match[2]) ||
        "(no anchor text)";

      const item: LinkItem = {
        url: absolute.href,
        anchor,
      };

      const linkHost =
        absolute.hostname.replace(
          /^www\./,
          ""
        );

      if (linkHost === currentHost) {
        internal.push(item);
      } else {
        external.push(item);
      }
    } catch {
      // Ignore malformed URLs.
    }
  }

  return {
    internal,
    external,
  };
}

function extractImages(html: string) {
  const images: ImageItem[] = [];

  const tags =
    html.match(/<img\b[^>]*>/gi) || [];

  for (const tag of tags) {
    const src =
      tag.match(
        /\bsrc\s*=\s*["']([^"']+)["']/i
      )?.[1] || "";

    const dataSrc =
      tag.match(
        /\bdata-src\s*=\s*["']([^"']+)["']/i
      )?.[1] || "";

    const finalSrc = src || dataSrc;

    if (!finalSrc) continue;

    const altMatch = tag.match(
      /\balt\s*=\s*["']([^"']*)["']/i
    );

    const alt =
      altMatch?.[1]?.trim() || "";

    images.push({
      src: finalSrc,
      alt,
      missingAlt: !alt,
    });
  }

  return images;
}

/*
 * Removes elements that commonly contain
 * non-article material.
 *
 * This is intentionally conservative.
 */
function cleanArticleCandidate(html: string) {
  return html
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )
    .replace(
      /<noscript[\s\S]*?<\/noscript>/gi,
      " "
    )
    .replace(
      /<svg[\s\S]*?<\/svg>/gi,
      " "
    )
    .replace(
      /<form[\s\S]*?<\/form>/gi,
      " "
    )
    .replace(
      /<nav[\s\S]*?<\/nav>/gi,
      " "
    )
    .replace(
      /<footer[\s\S]*?<\/footer>/gi,
      " "
    )
    .replace(
      /<aside[\s\S]*?<\/aside>/gi,
      " "
    );
}

/*
 * Try several common article containers.
 *
 * Coinlytx has been WordPress-backed, so
 * entry-content and wp-block-post-content
 * are especially useful candidates.
 */
function findArticleBody(html: string) {
  const candidates: {
    source: string;
    html: string;
    words: number;
  }[] = [];

  const patterns: {
    source: string;
    regex: RegExp;
  }[] = [
    {
      source: "article-element",
      regex:
        /<article\b[^>]*>([\s\S]*?)<\/article>/gi,
    },

    {
      source: "entry-content",
      regex:
        /<(?:div|main|section)\b[^>]*class=["'][^"']*\bentry-content\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|main|section)>/gi,
    },

    {
      source: "post-content",
      regex:
        /<(?:div|main|section)\b[^>]*class=["'][^"']*\bpost-content\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|main|section)>/gi,
    },

    {
      source: "wp-block-post-content",
      regex:
        /<(?:div|main|section)\b[^>]*class=["'][^"']*\bwp-block-post-content\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|main|section)>/gi,
    },

    {
      source: "single-content",
      regex:
        /<(?:div|main|section)\b[^>]*class=["'][^"']*\bsingle-content\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|main|section)>/gi,
    },

    {
      source: "article-content",
      regex:
        /<(?:div|main|section)\b[^>]*class=["'][^"']*\barticle-content\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|main|section)>/gi,
    },
  ];

  for (const pattern of patterns) {
    let match;

    while (
      (match = pattern.regex.exec(html)) !==
      null
    ) {
      const candidate =
        cleanArticleCandidate(
          match[1]
        );

      const text =
        stripTags(candidate);

      const words =
        countWords(text);

      if (words >= 100) {
        candidates.push({
          source: pattern.source,
          html: candidate,
          words,
        });
      }
    }
  }

  /*
   * Prefer the largest plausible candidate.
   */
  candidates.sort(
    (a, b) => b.words - a.words
  );

  if (candidates.length > 0) {
    return {
      html: candidates[0].html,
      source: candidates[0].source,
      isolated: true,
    };
  }

  /*
   * Fallback:
   * use <main> before falling back to
   * the complete document.
   */
  const mainMatch = html.match(
    /<main\b[^>]*>([\s\S]*?)<\/main>/i
  );

  if (mainMatch?.[1]) {
    return {
      html: cleanArticleCandidate(
        mainMatch[1]
      ),
      source: "main-fallback",
      isolated: false,
    };
  }

  return {
    html: cleanArticleCandidate(html),
    source: "full-page-fallback",
    isolated: false,
  };
}

function calculateScores(data: {
  title: string;
  description: string;
  canonical: string;

  noindex: boolean;

  h1Count: number;
  h2Count: number;

  wordCount: number;

  internalLinks: number;
  externalLinks: number;

  images: number;
  missingAlt: number;

  articleIsolated: boolean;
}) {
  let seo = 0;
  let contentQuality = 0;
  let internalLinks = 0;
  let technicalSEO = 0;
  let indexReadiness = 0;

  /*
   * SEO
   */

  if (data.title) {
    seo += 20;
  }

  if (
    data.title.length >= 30 &&
    data.title.length <= 65
  ) {
    seo += 15;
  }

  if (data.description) {
    seo += 20;
  }

  if (
    data.description.length >= 120 &&
    data.description.length <= 170
  ) {
    seo += 15;
  }

  if (data.h1Count === 1) {
    seo += 15;
  }

  if (data.h2Count >= 2) {
    seo += 15;
  }

  /*
   * Content quality
   *
   * Still rule-based — not AI quality.
   */

  if (data.wordCount >= 300) {
    contentQuality += 20;
  }

  if (data.wordCount >= 600) {
    contentQuality += 20;
  }

  if (data.wordCount >= 900) {
    contentQuality += 15;
  }

  if (data.h2Count >= 2) {
    contentQuality += 15;
  }

  if (data.externalLinks >= 1) {
    contentQuality += 10;
  }

  if (data.images >= 1) {
    contentQuality += 10;
  }

  if (
    data.images > 0 &&
    data.missingAlt === 0
  ) {
    contentQuality += 10;
  }

  /*
   * Contextual internal links only.
   */

  if (data.internalLinks >= 1) {
    internalLinks += 25;
  }

  if (data.internalLinks >= 2) {
    internalLinks += 25;
  }

  if (data.internalLinks >= 4) {
    internalLinks += 25;
  }

  if (data.internalLinks >= 6) {
    internalLinks += 25;
  }

  /*
   * Technical SEO
   */

  if (data.canonical) {
    technicalSEO += 25;
  }

  if (data.title) {
    technicalSEO += 20;
  }

  if (data.description) {
    technicalSEO += 20;
  }

  if (data.h1Count === 1) {
    technicalSEO += 15;
  }

  if (!data.noindex) {
    technicalSEO += 20;
  }

  /*
   * Index readiness
   *
   * This is an internal heuristic,
   * NOT Google's indexing probability.
   */

  if (!data.noindex) {
    indexReadiness += 25;
  }

  if (data.canonical) {
    indexReadiness += 15;
  }

  if (data.title) {
    indexReadiness += 10;
  }

  if (data.description) {
    indexReadiness += 10;
  }

  if (data.h1Count === 1) {
    indexReadiness += 10;
  }

  if (data.wordCount >= 400) {
    indexReadiness += 10;
  }

  if (data.internalLinks >= 1) {
    indexReadiness += 10;
  }

  if (data.articleIsolated) {
    indexReadiness += 5;
  }

  if (data.externalLinks >= 1) {
    indexReadiness += 5;
  }

  return {
    indexReadiness: Math.min(
      indexReadiness,
      100
    ),

    seo: Math.min(
      seo,
      100
    ),

    contentQuality: Math.min(
      contentQuality,
      100
    ),

    internalLinks: Math.min(
      internalLinks,
      100
    ),

    technicalSEO: Math.min(
      technicalSEO,
      100
    ),
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const inputUrl =
      body?.url?.trim();

    if (!inputUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Article URL is required.",
        },
        {
          status: 400,
        }
      );
    }

    let articleUrl: URL;

    try {
      articleUrl =
        new URL(inputUrl);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please enter a valid URL.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      articleUrl.protocol !==
        "https:" &&
      articleUrl.protocol !==
        "http:"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only HTTP and HTTPS URLs are supported.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * FETCH PAGE
     */

    const response =
      await fetch(
        articleUrl.href,
        {
          method: "GET",

          cache: "no-store",

          redirect: "follow",

          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; CoinlytxSEOAgent/1.1; +https://coinlytx.com)",

            Accept:
              "text/html,application/xhtml+xml",
          },
        }
      );

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,

          error:
            `Could not fetch article. HTTP ${response.status}.`,
        },
        {
          status: 502,
        }
      );
    }

    const html =
      await response.text();

    /*
     * DOCUMENT-LEVEL SEO
     */

    const title =
      stripTags(
        html.match(
          /<title[^>]*>([\s\S]*?)<\/title>/i
        )?.[1] || ""
      );

    const description =
      getMetaContent(
        html,
        "description"
      );

    const robots =
      getMetaContent(
        html,
        "robots"
      );

    const googlebot =
      getMetaContent(
        html,
        "googlebot"
      );

    const canonical =
      getCanonical(html);

    const noindex =
      /noindex/i.test(robots) ||
      /noindex/i.test(googlebot);

    /*
     * ISOLATE ARTICLE
     */

    const articleBody =
      findArticleBody(html);

    const articleHtml =
      articleBody.html;

    const articleText =
      stripTags(articleHtml);

    const wordCount =
      countWords(articleText);

    /*
     * ARTICLE-ONLY STRUCTURE
     */

    let h1 =
      extractHeadings(
        articleHtml,
        1
      );

    const h2 =
      extractHeadings(
        articleHtml,
        2
      );

    const h3 =
      extractHeadings(
        articleHtml,
        3
      );

    /*
     * Some themes keep the article
     * headline immediately outside
     * entry-content.
     *
     * If the isolated body has no H1,
     * use the page-level H1.
     */

    if (h1.length === 0) {
      const pageH1 =
        extractHeadings(
          html,
          1
        );

      if (pageH1.length === 1) {
        h1 = pageH1;
      }
    }

    /*
     * ARTICLE-ONLY LINKS
     */

    const links =
      extractLinks(
        articleHtml,
        response.url ||
          articleUrl.href
      );

    /*
     * Remove duplicate links.
     */

    const uniqueInternal =
      Array.from(
        new Map(
          links.internal.map(
            (link) => [
              `${link.url}|${link.anchor}`,
              link,
            ]
          )
        ).values()
      );

    const uniqueExternal =
      Array.from(
        new Map(
          links.external.map(
            (link) => [
              `${link.url}|${link.anchor}`,
              link,
            ]
          )
        ).values()
      );

    /*
     * ARTICLE-ONLY IMAGES
     */

    const images =
      extractImages(
        articleHtml
      );

    const missingAltImages =
      images.filter(
        (image) =>
          image.missingAlt
      );

    /*
     * SCORES
     */

    const scores =
      calculateScores({
        title,

        description,

        canonical,

        noindex,

        h1Count:
          h1.length,

        h2Count:
          h2.length,

        wordCount,

        internalLinks:
          uniqueInternal.length,

        externalLinks:
          uniqueExternal.length,

        images:
          images.length,

        missingAlt:
          missingAltImages.length,

        articleIsolated:
          articleBody.isolated,
      });

    /*
     * CHECKS
     */

    const criticalIssues:
      string[] = [];

    const improvements:
      string[] = [];

    const passedChecks:
      string[] = [];

    /*
     * INDEXING
     */

    if (noindex) {
      criticalIssues.push(
        "A noindex directive was detected."
      );
    } else {
      passedChecks.push(
        "No noindex meta directive detected."
      );
    }

    /*
     * TITLE
     */

    if (!title) {
      criticalIssues.push(
        "HTML title is missing."
      );
    } else {
      passedChecks.push(
        "HTML title detected."
      );

      if (
        title.length < 30
      ) {
        improvements.push(
          `Title is short (${title.length} characters).`
        );
      }

      if (
        title.length > 65
      ) {
        improvements.push(
          `Title is long (${title.length} characters). Review SERP presentation.`
        );
      }
    }

    /*
     * META DESCRIPTION
     */

    if (!description) {
      improvements.push(
        "Meta description was not detected."
      );
    } else {
      passedChecks.push(
        "Meta description detected."
      );

      if (
        description.length < 120
      ) {
        improvements.push(
          `Meta description is relatively short (${description.length} characters).`
        );
      }

      if (
        description.length > 170
      ) {
        improvements.push(
          `Meta description is long (${description.length} characters).`
        );
      }
    }

    /*
     * CANONICAL
     */

    if (!canonical) {
      improvements.push(
        "Canonical URL was not detected."
      );
    } else {
      passedChecks.push(
        "Canonical URL detected."
      );
    }

    /*
     * HEADINGS
     */

    if (h1.length === 0) {
      criticalIssues.push(
        "No H1 heading was detected."
      );
    } else if (
      h1.length > 1
    ) {
      improvements.push(
        `Multiple H1 headings detected (${h1.length}).`
      );
    } else {
      passedChecks.push(
        "Exactly one H1 heading detected."
      );
    }

    if (h2.length === 0) {
      improvements.push(
        "No H2 headings were detected inside the article."
      );
    } else {
      passedChecks.push(
        `${h2.length} article H2 headings detected.`
      );
    }

    /*
     * CONTENT LENGTH
     */

    if (
      wordCount < 300
    ) {
      improvements.push(
        `Article body contains approximately ${wordCount} words. Review whether the topic is covered sufficiently.`
      );
    } else {
      passedChecks.push(
        `Article body contains approximately ${wordCount} words.`
      );
    }

    /*
     * INTERNAL LINKS
     */

    if (
      uniqueInternal.length ===
      0
    ) {
      improvements.push(
        "No contextual internal links were detected inside the article body."
      );
    } else if (
      uniqueInternal.length < 2
    ) {
      improvements.push(
        `Only ${uniqueInternal.length} contextual internal link was detected inside the article body.`
      );
    } else {
      passedChecks.push(
        `${uniqueInternal.length} contextual internal links detected inside the article body.`
      );
    }

    /*
     * EXTERNAL LINKS
     */

    if (
      uniqueExternal.length ===
      0
    ) {
      improvements.push(
        "No external source links were detected inside the article body."
      );
    } else {
      passedChecks.push(
        `${uniqueExternal.length} external links detected inside the article body.`
      );
    }

    /*
     * IMAGES
     */

    if (
      images.length === 0
    ) {
      improvements.push(
        "No images were detected inside the isolated article body."
      );
    } else {
      passedChecks.push(
        `${images.length} article images detected.`
      );
    }

    if (
      missingAltImages.length >
      0
    ) {
      improvements.push(
        `${missingAltImages.length} article images have missing or empty ALT text.`
      );
    } else if (
      images.length > 0
    ) {
      passedChecks.push(
        "All detected article images contain ALT text."
      );
    }

    /*
     * HTTPS
     */

    const finalUrl =
      response.url ||
      articleUrl.href;

    if (
      finalUrl.startsWith(
        "https://"
      )
    ) {
      passedChecks.push(
        "HTTPS detected."
      );
    } else {
      criticalIssues.push(
        "The final article URL is not using HTTPS."
      );
    }

    /*
     * ARTICLE EXTRACTION
     */

    if (
      articleBody.isolated
    ) {
      passedChecks.push(
        `Article body successfully isolated using ${articleBody.source}.`
      );
    } else {
      improvements.push(
        `Precise article-body isolation was not confirmed. Analyzer used ${articleBody.source}.`
      );
    }

    /*
     * RESPONSE
     */

    return NextResponse.json({
      success: true,

      fetchedUrl:
        finalUrl,

      extraction: {
        isolated:
          articleBody.isolated,

        source:
          articleBody.source,
      },

      article: {
        title,

        metaDescription:
          description,

        canonical,

        robots: {
          robots,

          googlebot,

          noindex,
        },

        wordCount,

        headings: {
          h1,
          h2,
          h3,
        },

        links: {
          internalCount:
            uniqueInternal.length,

          externalCount:
            uniqueExternal.length,

          internal:
            uniqueInternal.slice(
              0,
              100
            ),

          external:
            uniqueExternal.slice(
              0,
              100
            ),
        },

        images: {
          total:
            images.length,

          missingAltCount:
            missingAltImages.length,

          missingAlt:
            missingAltImages.slice(
              0,
              50
            ),
        },
      },

      scores,

      checks: {
        criticalIssues,

        improvements,

        passedChecks,
      },

      diagnostics: {
        articleIsolation:
          articleBody.isolated,

        extractionSource:
          articleBody.source,

        note:
          "Scores are deterministic SEO heuristics. They are not Google indexing probabilities or AI editorial scores.",
      },
    });
  } catch (error) {
    console.error(
      "Coinlytx SEO analyzer:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          "Unexpected error while analyzing the article.",
      },
      {
        status: 500,
      }
    );
  }
}
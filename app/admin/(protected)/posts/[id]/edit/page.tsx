"use client";

import Link from "next/link";

import { useParams, useRouter } from "next/navigation";

import { useEffect, useMemo, useRef, useState } from "react";

type Article = {

  id: string;

  title: string | null;

  slug: string | null;

  excerpt: string | null;

  content: string | null;

  status: string | null;

  seo_title: string | null;

  meta_description: string | null;

  focus_keyword: string | null;

  canonical_url: string | null;

  category_id: string | null;

  featured_image_url: string | null;

  featured_image_alt: string | null;

  robots_index: boolean | null;

  robots_follow: boolean | null;

  word_count: number | null;

  published_at: string | null;

};

type Category = {

  id: string;

  name: string;

  slug: string;

};

type InternalLinkRecommendation = {

  articleId: string;

  title: string;

  slug: string;

  url: string;

  source?: "supabase" | "wordpress";

  anchor: string;

  anchorOptions?: string[];

  context?: string;

  relevance: number;

  canInsertAutomatically: boolean;

};

export default function EditArticlePage() {

  const params = useParams();

  const router = useRouter();

  const articleId = String(params.id);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [publishing, setPublishing] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [title, setTitle] = useState("");

  const [slug, setSlug] = useState("");

  const [excerpt, setExcerpt] = useState("");

  const [content, setContent] = useState("");

  const [focusKeyword, setFocusKeyword] = useState("");

  const [seoTitle, setSeoTitle] = useState("");

  const [metaDescription, setMetaDescription] = useState("");

  const [canonicalUrl, setCanonicalUrl] = useState("");

  const [status, setStatus] = useState("draft");

  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);

  const [categoryId, setCategoryId] = useState("");

  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const [categoryLoadError, setCategoryLoadError] = useState("");

  const contentRef = useRef<HTMLDivElement>(null);

  const [editorMessage, setEditorMessage] = useState("");

  const [editorMode, setEditorMode] = useState<"visual" | "html">("visual");

  const [featuredImageUrl, setFeaturedImageUrl] = useState("");

  const [featuredImageAlt, setFeaturedImageAlt] = useState("");

  const [imageFailed, setImageFailed] = useState(false);

const [selectedImage, setSelectedImage] = useState<File | null>(null);

const [uploadingImage, setUploadingImage] = useState(false);

const [uploadMessage, setUploadMessage] = useState("");

const [seoAnalyzing, setSeoAnalyzing] = useState(false);

const [seoAnalysisError, setSeoAnalysisError] = useState("");

const [seoAnalysis, setSeoAnalysis] = useState<any>(null);

const [internalLinksLoading, setInternalLinksLoading] = useState(false);

const [internalLinksError, setInternalLinksError] = useState("");

const [internalLinkRecommendations, setInternalLinkRecommendations] = useState<InternalLinkRecommendation[]>([]);

const [internalLinkCandidateCount, setInternalLinkCandidateCount] = useState(0);

const [internalLinkInsertMessage, setInternalLinkInsertMessage] = useState("");

const [insertedInternalLinks, setInsertedInternalLinks] = useState<string[]>([]);

const [autopilotRunning, setAutopilotRunning] = useState(false);

const [autopilotMessage, setAutopilotMessage] = useState("");

const [autopilotChanges, setAutopilotChanges] = useState<string[]>([]);

const [lastSeoFingerprint, setLastSeoFingerprint] = useState("");

const [cannibalizationAnalysis, setCannibalizationAnalysis] = useState<any>(null);

const [cannibalizationError, setCannibalizationError] = useState("");

const wordCount = useMemo(() => {

    const cleaned = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    return cleaned ? cleaned.split(" ").filter(Boolean).length : 0;

  }, [content]);

  async function loadCategories() {
    try {
      setCategoriesLoading(true);
      setCategoryLoadError("");

      const response = await fetch("/api/cms/categories", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to load categories."
        );
      }

      const loadedCategories = Array.isArray(data.categories)
        ? (data.categories as Category[])
        : [];

      setCategories(loadedCategories);

      if (loadedCategories.length === 0) {
        setCategoryLoadError(
          "No categories are stored in Supabase yet."
        );
      }
    } catch (err) {
      setCategories([]);
      setCategoryLoadError(
        err instanceof Error
          ? err.message
          : "Unable to load categories."
      );
    } finally {
      setCategoriesLoading(false);
    }
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const articleResponse = await fetch(
          `/api/cms/articles/${articleId}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const articleData = await articleResponse.json();

        if (!articleResponse.ok || !articleData.success) {
          throw new Error(
            articleData.error || "Unable to load article."
          );
        }

        const article = articleData.article as Article;

        setTitle(article.title || "");
        setSlug(article.slug || "");
        setExcerpt(article.excerpt || "");
        setContent(article.content || "");
        setFocusKeyword(article.focus_keyword || "");
        setSeoTitle(article.seo_title || "");
        setMetaDescription(article.meta_description || "");
        setCanonicalUrl(article.canonical_url || "");
        setStatus(article.status || "draft");
        setPublishedAt(article.published_at || null);
        setCategoryId(article.category_id || "");
        setFeaturedImageUrl(article.featured_image_url || "");
        setFeaturedImageAlt(article.featured_image_alt || "");

        await loadCategories();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load editor."
        );
      } finally {
        setLoading(false);
      }
    }

    if (articleId) loadData();
  }, [articleId]);

  useEffect(() => {

    setImageFailed(false);

  }, [featuredImageUrl]);

  useEffect(() => {
    if (editorMode !== "visual") return;

    const editor = contentRef.current;

    if (!editor) return;

    if (editor.innerHTML !== content) {
      editor.innerHTML = content;
    }
  }, [content, editorMode]);

  function escapeHtmlAttribute(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeHtmlText(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function syncVisualEditorContent(message?: string) {
    const editor = contentRef.current;

    if (!editor) return;

    setContent(editor.innerHTML);

    if (message) {
      setEditorMessage(message);
    }
  }

  function insertHtmlAtCursor(
    html: string,
    message: string
  ) {
    const editor = contentRef.current;

    if (!editor) return;

    editor.focus();
    document.execCommand("insertHTML", false, html);
    syncVisualEditorContent(message);
  }

  function insertTextAtCursor(
    text: string,
    message: string
  ) {
    const editor = contentRef.current;

    if (!editor) return;

    editor.focus();
    document.execCommand("insertText", false, text);
    syncVisualEditorContent(message);
  }

  function createTableHtml(
    rows: number,
    columns: number
  ) {
    const safeRows = Math.min(Math.max(rows, 1), 20);
    const safeColumns = Math.min(Math.max(columns, 1), 12);

    const headerCells = Array.from(
      { length: safeColumns },
      (_, index) => `<th>Heading ${index + 1}</th>`
    ).join("");

    const bodyRows = Array.from(
      { length: safeRows },
      () =>
        `<tr>${Array.from(
          { length: safeColumns },
          () => "<td>Cell</td>"
        ).join("")}</tr>`
    ).join("");

    return (
      `<div class="coinlytx-table-wrap">` +
      `<table><thead><tr>${headerCells}</tr></thead>` +
      `<tbody>${bodyRows}</tbody></table></div><p><br></p>`
    );
  }

  function applyEditorFormat(
    action:
      | "H2"
      | "H3"
      | "Bold"
      | "Italic"
      | "Underline"
      | "Strike"
      | "Bullets"
      | "Numbered"
      | "Link"
      | "Image"
      | "Quote"
      | "Code"
      | "Table"
      | "Shortcode"
      | "HR"
      | "Undo"
      | "Redo"
      | "Clear"
  ) {
    if (editorMode !== "visual") {
      setEditorMessage(
        "Switch to Visual mode to use formatting buttons."
      );
      return;
    }

    const editor = contentRef.current;

    if (!editor) return;

    editor.focus();

    if (action === "H2") {
      document.execCommand("formatBlock", false, "h2");
      syncVisualEditorContent("H2 applied.");
      return;
    }

    if (action === "H3") {
      document.execCommand("formatBlock", false, "h3");
      syncVisualEditorContent("H3 applied.");
      return;
    }

    if (action === "Bold") {
      document.execCommand("bold", false);
      syncVisualEditorContent("Bold formatting applied.");
      return;
    }

    if (action === "Italic") {
      document.execCommand("italic", false);
      syncVisualEditorContent("Italic formatting applied.");
      return;
    }

    if (action === "Underline") {
      document.execCommand("underline", false);
      syncVisualEditorContent("Underline applied.");
      return;
    }

    if (action === "Strike") {
      document.execCommand("strikeThrough", false);
      syncVisualEditorContent("Strikethrough applied.");
      return;
    }

    if (action === "Bullets") {
      document.execCommand("insertUnorderedList", false);
      syncVisualEditorContent("Bullet list applied.");
      return;
    }

    if (action === "Numbered") {
      document.execCommand("insertOrderedList", false);
      syncVisualEditorContent("Numbered list applied.");
      return;
    }

    if (action === "Quote") {
      document.execCommand("formatBlock", false, "blockquote");
      syncVisualEditorContent("Quote formatting applied.");
      return;
    }

    if (action === "Undo") {
      document.execCommand("undo", false);
      syncVisualEditorContent();
      return;
    }

    if (action === "Redo") {
      document.execCommand("redo", false);
      syncVisualEditorContent();
      return;
    }

    if (action === "Clear") {
      document.execCommand("removeFormat", false);
      syncVisualEditorContent("Formatting removed.");
      return;
    }

    if (action === "HR") {
      insertHtmlAtCursor(
        "<hr><p><br></p>",
        "Separator inserted."
      );
      return;
    }

    if (action === "Code") {
      const selectedText =
        window.getSelection()?.toString() || "";

      const codeText =
        selectedText ||
        window.prompt("Code/text:", "") ||
        "";

      if (!codeText) return;

      insertHtmlAtCursor(
        `<code>${escapeHtmlText(codeText)}</code>`,
        "Inline code inserted."
      );
      return;
    }

    if (action === "Table") {
      const rowInput =
        window.prompt("Number of table rows:", "3");

      if (!rowInput) return;

      const columnInput =
        window.prompt("Number of table columns:", "3");

      if (!columnInput) return;

      const rows = Number.parseInt(rowInput, 10);
      const columns = Number.parseInt(columnInput, 10);

      if (
        !Number.isFinite(rows) ||
        !Number.isFinite(columns) ||
        rows < 1 ||
        columns < 1
      ) {
        setEditorMessage(
          "Enter valid table rows and columns."
        );
        return;
      }

      insertHtmlAtCursor(
        createTableHtml(rows, columns),
        `${rows} × ${columns} table inserted.`
      );
      return;
    }

    if (action === "Shortcode") {
      const shortcode =
        window.prompt(
          'Enter shortcode, e.g. [my_shortcode id="123"]:',
          ""
        )?.trim() || "";

      if (!shortcode) return;

      insertTextAtCursor(
        shortcode,
        "Shortcode placeholder inserted. WordPress shortcodes need a Next.js shortcode renderer before they can execute on the public article."
      );
      return;
    }

    if (action === "Link") {
  const selectedText =
    window.getSelection()?.toString().trim() || "";

  const anchorText =
    selectedText ||
    window.prompt("Text to link:", "")?.trim() ||
    "";

  if (!anchorText) return;

  const url =
    window.prompt(
      "Enter URL. Internal links can start with /",
      "/"
    )?.trim() || "";

  if (!url) return;

  const validUrl =
    url.startsWith("/") ||
    /^https?:\/\//i.test(url) ||
    /^mailto:/i.test(url) ||
    /^tel:/i.test(url);

  if (!validUrl) {
    window.alert(
      "Please use a valid URL starting with https://, http://, /, mailto: or tel:"
    );
    return;
  }

  const linkType =
    window.prompt(
      [
        "Choose link type:",
        "",
        "1 = Dofollow",
        "2 = Nofollow",
        "3 = Sponsored / Affiliate",
        "4 = UGC",
        "",
        "Enter 1, 2, 3 or 4:"
      ].join("\n"),
      "1"
    )?.trim() || "1";

  if (!["1", "2", "3", "4"].includes(linkType)) {
    window.alert(
      "Invalid link type. Choose 1, 2, 3 or 4."
    );
    return;
  }

  const openNewTab =
    window.confirm("Open this link in a new tab?");

  const relParts: string[] = [];

  if (linkType === "2") {
    relParts.push("nofollow");
  }

  if (linkType === "3") {
    relParts.push("sponsored", "nofollow");
  }

  if (linkType === "4") {
    relParts.push("ugc", "nofollow");
  }

  if (openNewTab) {
    relParts.push("noopener", "noreferrer");
  }

  const uniqueRel = Array.from(
    new Set(relParts)
  ).join(" ");

  const targetAttribute =
    openNewTab
      ? ' target="_blank"'
      : "";

  const relAttribute =
    uniqueRel
      ? ` rel="${escapeHtmlAttribute(uniqueRel)}"`
      : "";

  const linkHtml =
    `<a href="${escapeHtmlAttribute(url)}"` +
    `${targetAttribute}${relAttribute}>` +
    `${escapeHtmlText(anchorText)}</a>`;

  insertHtmlAtCursor(
    linkHtml,
    `Link added to "${anchorText}".`
  );

  return;
}

    if (action === "Image") {
      const url =
        window.prompt("Image URL:", "")?.trim() || "";

      if (!url) return;

      const alt =
        window.prompt(
          "Image ALT text:",
          focusKeyword || title
        )?.trim() || "";

      insertHtmlAtCursor(
        `<img src="${escapeHtmlAttribute(url)}" ` +
        `alt="${escapeHtmlAttribute(alt)}" ` +
        `style="max-width:100%;height:auto;" />`,
        "Image inserted."
      );
    }
  }

  async function uploadFeaturedImage() {

    try {

      if (!selectedImage) {

        throw new Error("Choose an image first.");

      }

      const allowedTypes = [

        "image/jpeg",

        "image/png",

        "image/webp",

        "image/avif",

      ];

      if (!allowedTypes.includes(selectedImage.type)) {

        throw new Error("Use a JPG, PNG, WebP or AVIF image.");

      }

      if (selectedImage.size > 10 * 1024 * 1024) {

        throw new Error("Image must be smaller than 10 MB.");

      }

      setUploadingImage(true);

      setError("");

      setSuccess("");

      setUploadMessage("");

      const formData = new FormData();

      formData.append("file", selectedImage);

      const response = await fetch("/api/cms/upload-image", {

        method: "POST",

        body: formData,

      });

      const data = await response.json();

      if (!response.ok || !data.success) {

        throw new Error(

          data.details || data.error || "Unable to upload image."

        );

      }

      setFeaturedImageUrl(data.image.url);

      setImageFailed(false);

      setSelectedImage(null);

      setUploadMessage(

        "Image uploaded. Save Changes or Publish to attach it to this article."

      );

    } catch (err) {

      setError(

        err instanceof Error ? err.message : "Unable to upload image."

      );

    } finally {

      setUploadingImage(false);

    }

  }

  function getArticlePayload() {

    return {

      title,

      slug,

      excerpt,

      content,

      focusKeyword,

      seoTitle,

      metaDescription,

      canonicalUrl,

      categoryId,

      featuredImageUrl,

      featuredImageAlt,

    };

  }

  function getSeoFingerprint() {

    return JSON.stringify({

      title,

      slug,

      excerpt,

      contentLength: content.length,

      contentStart: content.slice(0, 500),

      contentEnd: content.slice(-500),

      focusKeyword,

      seoTitle,

      metaDescription,

      canonicalUrl,

      featuredImageUrl,

      featuredImageAlt,

      categoryId,

      status,

    });

  }

  function getSeoPayload() {

    return {

      articleId,

      title,

      slug,

      excerpt,

      content,

      status,

      publishedAt,

      categoryId,

      focusKeyword,

      seoTitle,

      metaDescription,

      canonicalUrl,

      featuredImageUrl,

      featuredImageAlt,

    };

  }

  async function requestSeoAnalysis() {

    const response = await fetch(

      "/api/seo/analyze-draft",

      {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

        },

        body: JSON.stringify(getSeoPayload()),

      }

    );

    const data = await response.json();

    if (!response.ok || !data.success) {

      throw new Error(

        data.error ||

          "Unable to analyze article."

      );

    }

    return data;

  }

  async function requestInternalLinks() {

    const response = await fetch("/api/seo/internal-links", {

      method: "POST",

      headers: {

        "Content-Type": "application/json",

      },

      body: JSON.stringify({

        title,

        content,

        focusKeyword,

        currentArticleId: articleId,

        currentSlug: slug,

      }),

    });

    const data = await response.json();

    if (!response.ok || !data.success) {

      throw new Error(

        data.error ||

          "Unable to find internal link recommendations."

      );

    }

    return data;

  }

  async function requestCannibalizationAnalysis() {

    const response = await fetch(

      "/api/seo/cannibalization",

      {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

        },

        body: JSON.stringify({

          currentArticleId: articleId,

          title,

          slug,

          content,

          focusKeyword,

        }),

      }

    );

    const data = await response.json();

    if (!response.ok || !data.success) {

      throw new Error(

        data.error ||

          "Unable to analyze keyword cannibalization."

      );

    }

    return data;

  }

  function applySafeSeoFixes(analysis: any) {

    const changes: string[] = [];

    const suggestions = analysis?.suggestions || {};

    const nextFocusKeyword = String(

      suggestions.focusKeyword || ""

    ).trim();

    const nextSeoTitle = String(

      suggestions.seoTitles?.[0] || ""

    ).trim();

    const nextMetaDescription = String(

      suggestions.metaDescriptions?.[0] || ""

    ).trim();

    const nextCanonical = String(

      suggestions.canonical || ""

    ).trim();

    const nextImageAlt = String(

      suggestions.imageAlt || ""

    ).trim();

    if (

      nextFocusKeyword &&

      nextFocusKeyword !== focusKeyword

    ) {

      setFocusKeyword(nextFocusKeyword);

      changes.push(

        `Focus keyword → ${nextFocusKeyword}`

      );

    }

    if (

      nextSeoTitle &&

      nextSeoTitle !== seoTitle

    ) {

      setSeoTitle(nextSeoTitle);

      changes.push(

        `SEO title → ${nextSeoTitle}`

      );

    }

    if (

      nextMetaDescription &&

      nextMetaDescription !== metaDescription

    ) {

      setMetaDescription(nextMetaDescription);

      changes.push(

        "Meta description updated"

      );

    }

    if (

      nextCanonical &&

      nextCanonical !== canonicalUrl

    ) {

      setCanonicalUrl(nextCanonical);

      changes.push(

        `Canonical → ${nextCanonical}`

      );

    }

    if (

      featuredImageUrl &&

      nextImageAlt &&

      nextImageAlt !== featuredImageAlt

    ) {

      setFeaturedImageAlt(nextImageAlt);

      changes.push(

        "Featured image alt text updated"

      );

    }

    setAutopilotChanges(changes);

    // Safe fixes change the article state, so require one fresh audit before publishing.
    setLastSeoFingerprint("");

    return changes;

  }

  function hasPendingSafeFixes(analysis: any) {

    const suggestions = analysis?.suggestions || {};

    const nextFocusKeyword = String(

      suggestions.focusKeyword || ""

    ).trim();

    const nextSeoTitle = String(

      suggestions.seoTitles?.[0] || ""

    ).trim();

    const nextMetaDescription = String(

      suggestions.metaDescriptions?.[0] || ""

    ).trim();

    const nextCanonical = String(

      suggestions.canonical || ""

    ).trim();

    const nextImageAlt = String(

      suggestions.imageAlt || ""

    ).trim();

    return Boolean(

      (nextFocusKeyword &&

        nextFocusKeyword !== focusKeyword) ||

        (nextSeoTitle &&

          nextSeoTitle !== seoTitle) ||

        (nextMetaDescription &&

          nextMetaDescription !==

            metaDescription) ||

        (nextCanonical &&

          nextCanonical !== canonicalUrl) ||

        (featuredImageUrl &&

          nextImageAlt &&

          nextImageAlt !==

            featuredImageAlt)

    );

  }

  async function runSeoAutopilot(

    applySafeFixes = false,

    prePublishCheck = false

  ) {

    try {

      if (!title.trim()) {

        throw new Error(

          "Add an article title before running SEO Autopilot."

        );

      }

      setAutopilotRunning(true);

      setSeoAnalyzing(true);

      setInternalLinksLoading(true);

      setSeoAnalysisError("");

      setInternalLinksError("");

      setAutopilotMessage("");

      if (!prePublishCheck) {

        setAutopilotChanges([]);

      }

      setCannibalizationError("");

      const results = await Promise.allSettled([

        requestSeoAnalysis(),

        requestInternalLinks(),

        requestCannibalizationAnalysis(),

      ]);

      const analysisResult = results[0];

      const internalLinksResult =

        results[1];

      const cannibalizationResult =

        results[2];

      if (

        analysisResult.status ===

        "rejected"

      ) {

        throw analysisResult.reason;

      }

      const analysis =

        analysisResult.value;

      setSeoAnalysis(analysis);

      setLastSeoFingerprint(

        getSeoFingerprint()

      );

      if (

        internalLinksResult.status ===

        "fulfilled"

      ) {

        const linkData =

          internalLinksResult.value;

        setInternalLinkCandidateCount(

          linkData.totalCandidates || 0

        );

        setInternalLinkRecommendations(

          Array.isArray(

            linkData.recommendations

          )

            ? linkData.recommendations

            : []

        );

      } else {

        setInternalLinksError(

          internalLinksResult.reason instanceof Error

            ? internalLinksResult.reason.message

            : "Internal-link analysis could not be completed."

        );

      }

      if (

        cannibalizationResult.status ===

        "fulfilled"

      ) {

        setCannibalizationAnalysis(

          cannibalizationResult.value

        );

      } else {

        setCannibalizationAnalysis(null);

        setCannibalizationError(

          cannibalizationResult.reason instanceof Error

            ? cannibalizationResult.reason.message

            : "Cannibalization analysis could not be completed."

        );

      }

      const criticalCount =

        analysis.checks

          ?.criticalIssues?.length || 0;

      const improvementCount =

        analysis.checks

          ?.improvements?.length || 0;

      const priorityCount =

        analysis.priorityActions

          ?.length || 0;

      if (applySafeFixes) {

        const changes =

          applySafeSeoFixes(

            analysis

          );

        setAutopilotMessage(

          changes.length > 0

            ? `SEO Autopilot applied ${changes.length} safe correction${changes.length === 1 ? "" : "s"}. Review editorial recommendations and internal links before publishing.`

            : "SEO Autopilot found no safe metadata corrections to apply. Review the remaining editorial recommendations."

        );

      } else {

        setAutopilotMessage(

          criticalCount > 0

            ? `Audit complete: ${criticalCount} critical issue${criticalCount === 1 ? "" : "s"}, ${improvementCount} improvement${improvementCount === 1 ? "" : "s"}, ${priorityCount} priority action${priorityCount === 1 ? "" : "s"}.`

            : `Audit complete: no critical blockers. ${improvementCount} improvement${improvementCount === 1 ? "" : "s"} and ${priorityCount} priority action${priorityCount === 1 ? "" : "s"} found.`

        );

      }

      return analysis;

    } catch (err) {

      const message =

        err instanceof Error

          ? err.message

          : "SEO Autopilot failed.";

      setSeoAnalysisError(

        message

      );

      if (!prePublishCheck) {

        setAutopilotMessage("");

      }

      throw err;

    } finally {

      setAutopilotRunning(false);

      setSeoAnalyzing(false);

      setInternalLinksLoading(false);

    }

  }

  async function analyzeDraftSeo() {

    try {

      await runSeoAutopilot(false);

    } catch {}

  }

  async function findInternalLinkRecommendations() {

    try {

      if (!title.trim() && !content.trim()) {

        throw new Error(

          "Add an article title or content before finding internal links."

        );

      }

      setInternalLinksLoading(true);

      setInternalLinksError("");

      setInternalLinkInsertMessage("");

      const response = await fetch("/api/seo/internal-links", {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

        },

        body: JSON.stringify({

          title,

          content,

          focusKeyword,

          currentArticleId: articleId,

          currentSlug: slug,

        }),

      });

      const data = await response.json();

      if (!response.ok || !data.success) {

        throw new Error(

          data.error ||

            "Unable to find internal link recommendations."

        );

      }

      setInternalLinkCandidateCount(data.totalCandidates || 0);

      setInternalLinkRecommendations(

        Array.isArray(data.recommendations)

          ? data.recommendations

          : []

      );

    } catch (err) {

      setInternalLinksError(

        err instanceof Error

          ? err.message

          : "Unable to find internal link recommendations."

      );

      setInternalLinkRecommendations([]);

      setInternalLinkCandidateCount(0);

    } finally {

      setInternalLinksLoading(false);

    }

  }

  function insertRecommendedInternalLink(

    item: InternalLinkRecommendation

  ) {

    try {

      setInternalLinksError("");

      setInternalLinkInsertMessage("");

      if (!item.anchor.trim()) {

        throw new Error(

          "No exact anchor phrase was found in the article content."

        );

      }

      if (!content.trim()) {

        throw new Error("Article content is empty.");

      }

      const parser = new DOMParser();

      const documentWithRoot = parser.parseFromString(

        `<div id="coinlytx-editor-root">${content}</div>`,

        "text/html"

      );

      const root = documentWithRoot.getElementById(

        "coinlytx-editor-root"

      );

      if (!root) {

        throw new Error("Unable to read article content.");

      }

      const targetPath = `/${item.slug}`.replace(/\/+$/, "");

      const existingLinks = Array.from(

        root.querySelectorAll<HTMLAnchorElement>("a[href]")

      );

      const duplicateTarget = existingLinks.some((link) => {

        try {

          const parsed = new URL(

            link.getAttribute("href") || "",

            "https://coinlytx.com"

          );

          return (

            parsed.pathname.replace(/\/+$/, "") === targetPath

          );

        } catch {

          return false;

        }

      });

      if (duplicateTarget) {

        throw new Error(

          "This article already contains a link to that target."

        );

      }

      const walker = documentWithRoot.createTreeWalker(

        root,

        NodeFilter.SHOW_TEXT

      );

      const target = item.anchor.toLocaleLowerCase();

      let currentNode = walker.nextNode();

      while (currentNode) {

        const textNode = currentNode as Text;

        const parent = textNode.parentElement;

        const text = textNode.nodeValue || "";

        const blocked =

          parent?.closest(

            "a,script,style,code,pre,h1,h2,h3,h4,h5,h6"

          ) || null;

        if (!blocked) {

          const index = text

            .toLocaleLowerCase()

            .indexOf(target);

          if (index >= 0) {

            const matchedText = text.slice(

              index,

              index + item.anchor.length

            );

            const fragment =

              documentWithRoot.createDocumentFragment();

            const before = text.slice(0, index);

            const after = text.slice(

              index + item.anchor.length

            );

            if (before) {

              fragment.appendChild(

                documentWithRoot.createTextNode(before)

              );

            }

            const link =

              documentWithRoot.createElement("a");

            link.setAttribute("href", `/${item.slug}`);

            link.textContent = matchedText;

            fragment.appendChild(link);

            if (after) {

              fragment.appendChild(

                documentWithRoot.createTextNode(after)

              );

            }

            textNode.parentNode?.replaceChild(

              fragment,

              textNode

            );

            setContent(root.innerHTML);

            setInsertedInternalLinks((current) =>

              current.includes(item.articleId)

                ? current

                : [...current, item.articleId]

            );

            setInternalLinkInsertMessage(

              `Inserted internal link on "${matchedText}" → /${item.slug}. Click Save Changes or Update Published Article to store it.`

            );

            return;

          }

        }

        currentNode = walker.nextNode();

      }

      throw new Error(

        `The suggested phrase "${item.anchor}" was not found in a safe body-text position.`

      );

    } catch (err) {

      setInternalLinksError(

        err instanceof Error

          ? err.message

          : "Unable to insert internal link."

      );

    }

  }

  function validateArticle() {

    if (!title.trim()) throw new Error("Article title is required.");

    if (!slug.trim()) throw new Error("Article slug is required.");

    if (!content.trim()) throw new Error("Article content is required.");

  }

  async function submitArticle(action: "save" | "publish") {

    try {

      validateArticle();

      if (action === "publish") {

        const currentFingerprint =

          getSeoFingerprint();

        let publishAnalysis =

          seoAnalysis;

        if (

          !publishAnalysis ||

          lastSeoFingerprint !==

            currentFingerprint

        ) {

          setSuccess("");

          setError("");

          setAutopilotMessage(

            "Running required SEO pre-publish audit..."

          );

          publishAnalysis =

            await runSeoAutopilot(

              false,

              true

            );

        }

        const criticalIssues =

          publishAnalysis?.checks

            ?.criticalIssues || [];

        if (

          criticalIssues.length >

          0

        ) {

          throw new Error(

            `Publishing blocked by SEO Autopilot: ${criticalIssues[0]}`

          );

        }

        if (

          hasPendingSafeFixes(

            publishAnalysis

          )

        ) {

          throw new Error(

            "SEO Autopilot found safe metadata corrections. Click “Correct Safe Issues”, review the changes, then publish again."

          );

        }

      }

      if (

        action === "publish" &&

        !window.confirm(

          status === "published"

            ? "Save these changes to the published article?"

            : "Publish this article now?"

        )

      ) {

        return;

      }

      if (action === "save") setSaving(true);

      if (action === "publish") setPublishing(true);

      setError("");

      setSuccess("");

      const response = await fetch(`/api/cms/articles/${articleId}`, {

        method: "PATCH",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({

          ...getArticlePayload(),

          action,

        }),

      });

      const data = await response.json();

      if (!response.ok || !data.success) {

        throw new Error(data.details || data.error || "Unable to update article.");

      }

      if (data.article?.status) setStatus(data.article.status);

      if (data.article?.published_at) setPublishedAt(data.article.published_at);

      if (data.article?.category_id !== undefined) {

        setCategoryId(data.article.category_id || "");

      }

      if (data.article?.featured_image_url !== undefined) {

        setFeaturedImageUrl(data.article.featured_image_url || "");

      }

      if (data.article?.featured_image_alt !== undefined) {

        setFeaturedImageAlt(data.article.featured_image_alt || "");

      }

      setSuccess(

        action === "publish"

          ? status === "published"

            ? "Published article updated successfully."

            : "Article published successfully."

          : status === "published"

            ? "Published article changes saved."

            : "Draft updated successfully."

      );

      router.refresh();

    } catch (err) {

      setError(err instanceof Error ? err.message : "Unable to update article.");

    } finally {

      setSaving(false);

      setPublishing(false);

    }

  }

  if (loading) {

    return (

      <main style={loadingStyle}>

        Loading article...

      </main>

    );

  }

  return (

    <main style={pageStyle}>

      <div style={{ maxWidth: "1250px", margin: "0 auto" }}>

        <div style={headerStyle}>

          <div>

            <div style={eyebrowStyle}>COINLYTX CMS</div>

            <h1 style={{ margin: "7px 0 5px", fontSize: "34px" }}>Edit Article</h1>

            <div style={{ color: "#94a3b8" }}>

              Edit content, featured image, category, SEO and publishing status.

            </div>

          </div>

          <Link href="/admin/posts" style={backLinkStyle}>

            ← Back to Articles

          </Link>

        </div>

        <div className="edit-grid" style={gridStyle}>

          <div>

            <Section>

              <FieldLabel>Article Title *</FieldLabel>

              <input

                value={title}

                onChange={(e) => setTitle(e.target.value)}

                style={inputStyle}

                placeholder="Article title"

              />

              <FieldLabel>URL Slug *</FieldLabel>

              <input

                value={slug}

                onChange={(e) =>

                  setSlug(

                    e.target.value

                      .toLowerCase()

                      .replace(/[^a-z0-9-]/g, "-")

                      .replace(/-+/g, "-")

                      .replace(/^-+|-+$/g, "")

                  )

                }

                style={inputStyle}

              />

              <div style={urlPreviewStyle}>https://coinlytx.com/{slug}</div>

              <FieldLabel>Excerpt</FieldLabel>

              <textarea

                value={excerpt}

                onChange={(e) => setExcerpt(e.target.value)}

                style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }}

                placeholder="Short article summary..."

              />

            </Section>

            <Section>

              <div style={sectionHeaderStyle}>

                <strong>Article Content *</strong>

                <span style={{ color: "#60a5fa", fontSize: "12px" }}>

                  {wordCount} words

                </span>

              </div>

              <div style={editorModeSwitchRowStyle}>
                <div style={editorModeTabsStyle}>
                  <button
                    type="button"
                    onClick={() => setEditorMode("visual")}
                    style={{
                      ...editorModeTabStyle,
                      ...(editorMode === "visual"
                        ? editorModeTabActiveStyle
                        : {}),
                    }}
                  >
                    Visual
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditorMode("html")}
                    style={{
                      ...editorModeTabStyle,
                      ...(editorMode === "html"
                        ? editorModeTabActiveStyle
                        : {}),
                    }}
                  >
                    HTML
                  </button>
                </div>

                <span style={editorModeHintStyle}>
                  {editorMode === "visual"
                    ? "Rich text editor"
                    : "Raw HTML source"}
                </span>
              </div>

              <div style={toolbarStyle}>
                {([
                  "H2",
                  "H3",
                  "Bold",
                  "Italic",
                  "Underline",
                  "Strike",
                  "Bullets",
                  "Numbered",
                  "Link",
                  "Image",
                  "Quote",
                  "Code",
                  "Table",
                  "Shortcode",
                  "HR",
                  "Undo",
                  "Redo",
                  "Clear",
                ] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyEditorFormat(item)}
                    style={{
                      ...toolbarButtonStyle,
                      opacity: editorMode === "visual" ? 1 : 0.45,
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div style={toolbarHelpStyle}>
                Visual mode works like WordPress. HTML mode lets you edit raw
                markup. Tables, lists, code, images, links and shortcode
                placeholders are available from the toolbar.
              </div>

              {editorMode === "visual" ? (
                <div
                  ref={contentRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => {
                    setContent(e.currentTarget.innerHTML);
                    setEditorMessage("");
                  }}
                  style={contentStyle}
                  spellCheck
                  aria-label="Article Content visual editor"
                />
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setEditorMessage("");
                  }}
                  style={htmlSourceStyle}
                  spellCheck={false}
                  aria-label="Article Content HTML source"
                />
              )}

              {editorMode === "html" && (
                <div style={htmlWarningStyle}>
                  HTML mode edits the exact markup saved with the article.
                </div>
              )}

              {editorMessage && (
                <div style={editorMessageStyle}>
                  {editorMessage}
                </div>
              )}

            </Section>

          </div>

          <div>

            <Section>

              <h2 style={sectionTitleStyle}>Article Details</h2>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "8px",
                }}
              >
                <FieldLabel>Category</FieldLabel>

                <button
                  type="button"
                  onClick={loadCategories}
                  disabled={categoriesLoading}
                  style={smallUtilityButtonStyle}
                >
                  {categoriesLoading ? "Loading..." : "Reload Categories"}
                </button>
              </div>

              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                style={inputStyle}
                disabled={categoriesLoading}
              >
                <option value="">
                  {categoriesLoading
                    ? "Loading categories..."
                    : categories.length
                      ? "Select category"
                      : "No categories available"}
                </option>

                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              {categoryLoadError && (
                <div style={categoryWarningStyle}>
                  {categoryLoadError}
                </div>
              )}

              {!categoryLoadError && categories.length > 0 && (
                <div style={categoryCountStyle}>
                  {categories.length} categories available
                </div>
              )}

              <FieldLabel>Upload Featured Image</FieldLabel>

              <input

                type="file"

                accept="image/jpeg,image/png,image/webp,image/avif"

                onChange={(e) => {

                  const file = e.target.files?.[0] || null;

                  setSelectedImage(file);

                  setUploadMessage("");

                }}

                style={{

                  ...inputStyle,

                  padding: "10px",

                  cursor: "pointer",

                }}

              />

              {selectedImage && (

                <div

                  style={{

                    color: "#94a3b8",

                    fontSize: "12px",

                    marginTop: "-10px",

                    marginBottom: "12px",

                    overflowWrap: "anywhere",

                  }}

                >

                  Selected: {selectedImage.name} ·{" "}

                  {(selectedImage.size / 1024 / 1024).toFixed(2)} MB

                </div>

              )}

              <button

                type="button"

                onClick={uploadFeaturedImage}

                disabled={!selectedImage || uploadingImage}

                style={{

                  width: "100%",

                  border: "1px solid #2563eb",

                  borderRadius: "9px",

                  padding: "12px 14px",

                  background: "#1d4ed8",

                  color: "#ffffff",

                  fontSize: "13px",

                  fontWeight: 900,

                  marginBottom: "14px",

                  cursor:

                    !selectedImage || uploadingImage

                      ? "not-allowed"

                      : "pointer",

                  opacity:

                    !selectedImage || uploadingImage ? 0.6 : 1,

                }}

              >

                {uploadingImage

                  ? "Uploading..."

                  : "Upload Featured Image"}

              </button>

              {uploadMessage && (

                <div

                  style={{

                    padding: "10px 12px",

                    borderRadius: "8px",

                    marginBottom: "16px",

                    background: "rgba(20,83,45,.35)",

                    border: "1px solid rgba(34,197,94,.3)",

                    color: "#86efac",

                    fontSize: "12px",

                    lineHeight: 1.5,

                  }}

                >

                  {uploadMessage}

                </div>

              )}

              <FieldLabel>Featured Image URL</FieldLabel>

              <input

                value={featuredImageUrl}

                onChange={(e) => setFeaturedImageUrl(e.target.value)}

                style={inputStyle}

                placeholder="Uploaded image URL appears here automatically"

              />

              {featuredImageUrl && !imageFailed ? (

                <div style={imagePreviewBoxStyle}>

                  <img

                    src={featuredImageUrl}

                    alt={featuredImageAlt || title || "Featured image preview"}

                    onError={() => setImageFailed(true)}

                    style={imagePreviewStyle}

                  />

                </div>

              ) : featuredImageUrl && imageFailed ? (

                <div style={imageErrorStyle}>

                  Image preview could not be loaded. Check the URL.

                </div>

              ) : (

                <div style={emptyImageStyle}>Featured image preview</div>

              )}

              <FieldLabel>Featured Image Alt Text</FieldLabel>

              <input

                value={featuredImageAlt}

                onChange={(e) => setFeaturedImageAlt(e.target.value)}

                style={{ ...inputStyle, marginBottom: 0 }}

                placeholder="Describe the image for accessibility and SEO"

              />

            </Section>

            <Section>

              <h2 style={sectionTitleStyle}>SEO Settings</h2>

              <FieldLabel>Focus Keyword</FieldLabel>

              <input

                value={focusKeyword}

                onChange={(e) => setFocusKeyword(e.target.value)}

                style={inputStyle}

                placeholder="e.g. bitcoin price"

              />

              <FieldLabel>SEO Title</FieldLabel>

              <input

                value={seoTitle}

                maxLength={60}

                onChange={(e) => setSeoTitle(e.target.value)}

                style={inputStyle}

                placeholder="Search engine title"

              />

              <Counter value={seoTitle.length} max={60} />

              <FieldLabel>Meta Description</FieldLabel>

              <textarea

                value={metaDescription}

                maxLength={160}

                onChange={(e) => setMetaDescription(e.target.value)}

                style={{ ...inputStyle, minHeight: "110px", resize: "vertical" }}

                placeholder="Description for search results..."

              />

              <Counter value={metaDescription.length} max={160} />

              <FieldLabel>Canonical URL</FieldLabel>

              <input

                value={canonicalUrl}

                onChange={(e) => setCanonicalUrl(e.target.value)}

                style={inputStyle}

                placeholder={`https://coinlytx.com/${slug}`}

              />

            </Section>

            <Section>

              <h2 style={sectionTitleStyle}>Publishing</h2>

              <div style={publishingRowStyle}>

                <span style={{ color: "#94a3b8" }}>Current status</span>

                <StatusBadge status={status} />

              </div>

              {publishedAt && (

                <div style={publishedDateStyle}>

                  Published: {new Date(publishedAt).toLocaleString()}

                </div>

              )}

              {error && <Message type="error">{error}</Message>}

              {success && <Message type="success">{success}</Message>}

              <button

                type="button"

                onClick={() => submitArticle("save")}

                disabled={saving || publishing}

                style={{

                  ...secondaryButtonStyle,

                  opacity: saving || publishing ? 0.65 : 1,

                  cursor: saving || publishing ? "not-allowed" : "pointer",

                }}

              >

                {saving

                  ? "Saving..."

                  : status === "published"

                    ? "Save Changes"

                    : "Update Draft"}

              </button>

              <button

                type="button"

                onClick={() => submitArticle("publish")}

                disabled={saving || publishing}

                style={{

                  ...publishButtonStyle,

                  background: status === "published" ? "#38bdf8" : "#22c55e",

                  opacity: saving || publishing ? 0.65 : 1,

                  cursor: saving || publishing ? "not-allowed" : "pointer",

                }}

              >

                {publishing

                  ? "Publishing..."

                  : status === "published"

                    ? "Update Published Article"

                    : "Publish Now"}

              </button>

              {status === "published" && slug && (

                <a

                  href={`https://coinlytx.com/${slug}`}

                  target="_blank"

                  rel="noopener noreferrer"

                  style={viewArticleStyle}

                >

                  View Article ↗

                </a>

              )}

            </Section>

            <Section>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "14px" }}>

                <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Coinlytx SEO Autopilot</h2>

                {seoAnalysis && <span style={{ fontSize: "11px", fontWeight: 900, color: "#22c55e" }}>ANALYZED</span>}

              </div>

              <div
                style={{
                  padding: "14px",
                  borderRadius: "11px",
                  border: "1px solid #1e40af",
                  background: "rgba(30,64,175,.12)",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    color: "#dbeafe",
                    fontSize: "13px",
                    fontWeight: 900,
                    marginBottom: "6px",
                  }}
                >
                  SEO Autopilot
                </div>

                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: "11px",
                    lineHeight: 1.55,
                    marginBottom: "12px",
                  }}
                >
                  One audit checks content quality, metadata, search intent,
                  indexing, images, schema guidance, internal links and
                  human-writing signals. Publishing automatically runs a fresh
                  audit when the article has changed.
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => runSeoAutopilot(false)}
                    disabled={autopilotRunning}
                    style={{
                      border: 0,
                      borderRadius: "9px",
                      padding: "12px",
                      background: "#2563eb",
                      color: "#ffffff",
                      fontSize: "12px",
                      fontWeight: 900,
                      cursor: autopilotRunning
                        ? "not-allowed"
                        : "pointer",
                      opacity: autopilotRunning ? 0.65 : 1,
                    }}
                  >
                    {autopilotRunning
                      ? "Analyzing Everything..."
                      : "Analyze Everything"}
                  </button>

                  <button
                    type="button"
                    onClick={() => runSeoAutopilot(true)}
                    disabled={autopilotRunning}
                    style={{
                      border: "1px solid #16a34a",
                      borderRadius: "9px",
                      padding: "12px",
                      background: "#14532d",
                      color: "#dcfce7",
                      fontSize: "12px",
                      fontWeight: 900,
                      cursor: autopilotRunning
                        ? "not-allowed"
                        : "pointer",
                      opacity: autopilotRunning ? 0.65 : 1,
                    }}
                  >
                    Correct Safe Issues
                  </button>
                </div>

                {autopilotMessage && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "9px",
                      borderRadius: "8px",
                      background: "#020617",
                      border: "1px solid #1e293b",
                      color: "#bfdbfe",
                      fontSize: "10px",
                      lineHeight: 1.55,
                    }}
                  >
                    {autopilotMessage}
                  </div>
                )}

                {autopilotChanges.length > 0 && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "9px",
                      borderRadius: "8px",
                      background: "rgba(20,83,45,.22)",
                      border: "1px solid rgba(34,197,94,.3)",
                    }}
                  >
                    <div
                      style={{
                        color: "#86efac",
                        fontSize: "10px",
                        fontWeight: 900,
                        marginBottom: "6px",
                      }}
                    >
                      SAFE CHANGES APPLIED
                    </div>

                    {autopilotChanges.map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        style={{
                          color: "#dcfce7",
                          fontSize: "10px",
                          lineHeight: 1.5,
                          marginBottom: "3px",
                        }}
                      >
                        ✓ {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {seoAnalysisError && <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(127,29,29,.3)", border: "1px solid rgba(248,113,113,.3)", color: "#fca5a5", fontSize: "12px", marginBottom: "14px" }}>{seoAnalysisError}</div>}

              {!seoAnalysis && !seoAnalysisError && <p style={seoAgentTextStyle}>Run SEO Autopilot before publishing. Safe metadata corrections can be applied together, while editorial/content changes remain review-only.</p>}

              {seoAnalysis && (

                <div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "18px" }}>

                    <SeoScore label="SEO" score={seoAnalysis.scores?.seo ?? 0} />

                    <SeoScore label="Index" score={seoAnalysis.scores?.indexReadiness ?? 0} />

                    <SeoScore label="Content" score={seoAnalysis.scores?.contentQuality ?? 0} />

                    <SeoScore label="Internal Links" score={seoAnalysis.scores?.internalLinks ?? 0} />

                  </div>

                  <div style={{ background: "#020617", border: "1px solid #1e293b", borderRadius: "9px", padding: "12px", marginBottom: "16px" }}>

                    <SeoStat label="Words" value={seoAnalysis.article?.wordCount ?? 0} />

                    <SeoStat label="H2" value={seoAnalysis.article?.headings?.h2?.length ?? 0} />

                    <SeoStat label="Internal links" value={seoAnalysis.article?.links?.internalCount ?? 0} />

                    <SeoStat label="External links" value={seoAnalysis.article?.links?.externalCount ?? 0} />

                    <SeoStat label="Images" value={seoAnalysis.article?.images?.total ?? 0} />

                    <SeoStat label="Keyword uses" value={seoAnalysis.article?.keyword?.count ?? 0} />

                  </div>

                  {seoAnalysis.checks?.criticalIssues?.length > 0 && <SeoCheckGroup title="Critical" items={seoAnalysis.checks.criticalIssues} type="critical" />}

                  {seoAnalysis.checks?.improvements?.length > 0 && <SeoCheckGroup title="Improve" items={seoAnalysis.checks.improvements} type="warning" />}

                  {seoAnalysis.checks?.passedChecks?.length > 0 && <SeoCheckGroup title="Passed" items={seoAnalysis.checks.passedChecks} type="passed" />}

                  {seoAnalysis.suggestions && (
                    <div
                      style={{
                        marginTop: "16px",
                        padding: "14px",
                        borderRadius: "10px",
                        border: "1px solid #1e40af",
                        background: "rgba(30,64,175,.12)",
                      }}
                    >
                      <div style={{ fontSize: "13px", fontWeight: 900, color: "#dbeafe", marginBottom: "12px" }}>
                        SEO Suggestions
                      </div>

                      <div style={{ fontSize: "11px", color: "#93c5fd", marginBottom: "10px" }}>
                        Search intent: <strong>{seoAnalysis.suggestions.searchIntent || "—"}</strong>
                      </div>

                      <div style={{ marginBottom: "12px" }}>
                        <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 900, marginBottom: "5px" }}>
                          FOCUS KEYWORD
                        </div>
                        <div style={{ color: "#f8fafc", fontSize: "13px", fontWeight: 800, marginBottom: "7px" }}>
                          {seoAnalysis.suggestions.focusKeyword || "—"}
                        </div>
                        {seoAnalysis.suggestions.focusKeyword && (
                          <button
                            type="button"
                            onClick={() => setFocusKeyword(seoAnalysis.suggestions.focusKeyword)}
                            style={{ border: "1px solid #334155", borderRadius: "7px", padding: "7px 9px", background: "#0f172a", color: "#cbd5e1", fontSize: "10px", fontWeight: 900, cursor: "pointer" }}
                          >
                            Use Focus Keyword
                          </button>
                        )}
                      </div>

                      {seoAnalysis.suggestions.secondaryKeywords?.length > 0 && (
                        <div style={{ marginBottom: "12px" }}>
                          <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 900, marginBottom: "5px" }}>
                            SECONDARY TOPICS
                          </div>
                          <div style={{ color: "#cbd5e1", fontSize: "11px", lineHeight: 1.6 }}>
                            {seoAnalysis.suggestions.secondaryKeywords.join(" • ")}
                          </div>
                        </div>
                      )}

                      {seoAnalysis.suggestions.seoTitles?.length > 0 && (
                        <div style={{ marginBottom: "12px" }}>
                          <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 900, marginBottom: "7px" }}>
                            SEO TITLE SUGGESTIONS
                          </div>
                          {seoAnalysis.suggestions.seoTitles.map((item: string, index: number) => (
                            <div key={`${item}-${index}`} style={{ padding: "9px", borderRadius: "8px", background: "#020617", border: "1px solid #1e293b", marginBottom: "7px" }}>
                              <div style={{ color: "#f8fafc", fontSize: "12px", lineHeight: 1.5, marginBottom: "7px" }}>
                                {item}
                              </div>
                              <button
                                type="button"
                                onClick={() => setSeoTitle(item)}
                                style={{ border: "1px solid #334155", borderRadius: "7px", padding: "6px 8px", background: "#0f172a", color: "#cbd5e1", fontSize: "10px", fontWeight: 900, cursor: "pointer" }}
                              >
                                Use This Title
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {seoAnalysis.suggestions.metaDescriptions?.length > 0 && (
                        <div style={{ marginBottom: "12px" }}>
                          <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 900, marginBottom: "7px" }}>
                            META DESCRIPTION SUGGESTIONS
                          </div>
                          {seoAnalysis.suggestions.metaDescriptions.map((item: string, index: number) => (
                            <div key={`${item}-${index}`} style={{ padding: "9px", borderRadius: "8px", background: "#020617", border: "1px solid #1e293b", marginBottom: "7px" }}>
                              <div style={{ color: "#cbd5e1", fontSize: "11px", lineHeight: 1.55, marginBottom: "7px" }}>
                                {item}
                              </div>
                              <button
                                type="button"
                                onClick={() => setMetaDescription(item)}
                                style={{ border: "1px solid #334155", borderRadius: "7px", padding: "6px 8px", background: "#0f172a", color: "#cbd5e1", fontSize: "10px", fontWeight: 900, cursor: "pointer" }}
                              >
                                Use This Description
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px", marginBottom: "12px" }}>
                        <div style={{ padding: "9px", borderRadius: "8px", background: "#020617", border: "1px solid #1e293b" }}>
                          <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 900, marginBottom: "5px" }}>CANONICAL</div>
                          <div style={{ color: "#cbd5e1", fontSize: "10px", overflowWrap: "anywhere", marginBottom: "7px" }}>
                            {seoAnalysis.suggestions.canonical}
                          </div>
                          <button
                            type="button"
                            onClick={() => setCanonicalUrl(seoAnalysis.suggestions.canonical || "")}
                            style={{ border: "1px solid #334155", borderRadius: "7px", padding: "6px 8px", background: "#0f172a", color: "#cbd5e1", fontSize: "10px", fontWeight: 900, cursor: "pointer" }}
                          >
                            Use Canonical
                          </button>
                        </div>

                        <div style={{ padding: "9px", borderRadius: "8px", background: "#020617", border: "1px solid #1e293b" }}>
                          <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 900, marginBottom: "5px" }}>IMAGE ALT SUGGESTION</div>
                          <div style={{ color: "#cbd5e1", fontSize: "10px", lineHeight: 1.5, marginBottom: "7px" }}>
                            {seoAnalysis.suggestions.imageAlt}
                          </div>
                          <button
                            type="button"
                            onClick={() => setFeaturedImageAlt(seoAnalysis.suggestions.imageAlt || "")}
                            style={{ border: "1px solid #334155", borderRadius: "7px", padding: "6px 8px", background: "#0f172a", color: "#cbd5e1", fontSize: "10px", fontWeight: 900, cursor: "pointer" }}
                          >
                            Use Alt Text
                          </button>
                        </div>
                      </div>

                      {seoAnalysis.schema && (
                        <div style={{ padding: "10px", borderRadius: "8px", background: "#020617", border: "1px solid #1e293b", marginBottom: "12px" }}>
                          <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 900, marginBottom: "5px" }}>
                            SCHEMA RECOMMENDATION
                          </div>
                          <div style={{ color: "#86efac", fontSize: "12px", fontWeight: 900 }}>
                            {seoAnalysis.schema.type} + {(seoAnalysis.schema.alsoUse || []).join(" + ")}
                          </div>
                          {seoAnalysis.schema.conditional?.length > 0 && (
                            <div style={{ color: "#94a3b8", fontSize: "10px", lineHeight: 1.5, marginTop: "6px" }}>
                              {seoAnalysis.schema.conditional[0]}
                            </div>
                          )}
                        </div>
                      )}

                      {seoAnalysis.priorityActions?.length > 0 && (
                        <div style={{ padding: "10px", borderRadius: "8px", background: "#020617", border: "1px solid #1e293b" }}>
                          <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 900, marginBottom: "7px" }}>
                            PRIORITY ACTIONS
                          </div>
                          {seoAnalysis.priorityActions.map((item: string, index: number) => (
                            <div key={`${item}-${index}`} style={{ color: "#cbd5e1", fontSize: "10px", lineHeight: 1.55, marginBottom: "5px" }}>
                              {index + 1}. {item}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: "18px",
                      paddingTop: "18px",
                      borderTop: "1px solid #1e293b",
                    }}
                  >
                    <div style={{ color: "#f8fafc", fontSize: "13px", fontWeight: 900, marginBottom: "10px" }}>
                      Keyword Cannibalization
                    </div>

                    {cannibalizationError && (
                      <div
                        style={{
                          padding: "9px",
                          borderRadius: "8px",
                          background: "rgba(127,29,29,.25)",
                          border: "1px solid rgba(248,113,113,.25)",
                          color: "#fca5a5",
                          fontSize: "10px",
                          marginBottom: "10px",
                        }}
                      >
                        {cannibalizationError}
                      </div>
                    )}

                    {cannibalizationAnalysis && (
                      <div>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                            marginBottom: "10px",
                          }}
                        >
                          <div
                            style={{
                              padding: "8px 10px",
                              borderRadius: "8px",
                              background:
                                cannibalizationAnalysis.risk === "high"
                                  ? "rgba(127,29,29,.28)"
                                  : cannibalizationAnalysis.risk === "medium"
                                    ? "rgba(120,53,15,.28)"
                                    : "rgba(20,83,45,.28)",
                              border: "1px solid #334155",
                              color:
                                cannibalizationAnalysis.risk === "high"
                                  ? "#fca5a5"
                                  : cannibalizationAnalysis.risk === "medium"
                                    ? "#fcd34d"
                                    : "#86efac",
                              fontSize: "11px",
                              fontWeight: 900,
                              textTransform: "uppercase",
                            }}
                          >
                            {cannibalizationAnalysis.risk} Risk
                          </div>

                          <div
                            style={{
                              padding: "8px 10px",
                              borderRadius: "8px",
                              background: "#020617",
                              border: "1px solid #1e293b",
                              color: "#94a3b8",
                              fontSize: "10px",
                            }}
                          >
                            {cannibalizationAnalysis.scannedPublishedArticles || 0} published pages checked
                          </div>
                        </div>

                        {cannibalizationAnalysis.conflicts?.slice(0, 5).map(
                          (item: any, index: number) => (
                            <div
                              key={`${item.articleId}-${index}`}
                              style={{
                                padding: "10px",
                                borderRadius: "8px",
                                background: "#020617",
                                border: "1px solid #1e293b",
                                marginBottom: "8px",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                                <div>
                                  <div style={{ color: "#f8fafc", fontSize: "11px", fontWeight: 800, lineHeight: 1.45 }}>
                                    {item.title}
                                  </div>

                                  <div style={{ marginTop: "4px", color: "#64748b", fontSize: "9px", overflowWrap: "anywhere" }}>
                                    /{item.slug}
                                  </div>

                                  {item.focusKeyword && (
                                    <div style={{ marginTop: "5px", color: "#93c5fd", fontSize: "9px" }}>
                                      Existing focus: {item.focusKeyword}
                                    </div>
                                  )}
                                </div>

                                <div
                                  style={{
                                    minWidth: "50px",
                                    height: "fit-content",
                                    textAlign: "center",
                                    padding: "6px",
                                    borderRadius: "7px",
                                    background:
                                      item.risk === "high"
                                        ? "rgba(127,29,29,.3)"
                                        : item.risk === "medium"
                                          ? "rgba(120,53,15,.3)"
                                          : "rgba(30,64,175,.2)",
                                    color:
                                      item.risk === "high"
                                        ? "#fca5a5"
                                        : item.risk === "medium"
                                          ? "#fcd34d"
                                          : "#93c5fd",
                                    fontSize: "10px",
                                    fontWeight: 900,
                                  }}
                                >
                                  {item.similarity}%
                                </div>
                              </div>
                            </div>
                          )
                        )}

                        {cannibalizationAnalysis.recommendations?.map(
                          (item: string, index: number) => (
                            <div
                              key={`${item}-${index}`}
                              style={{
                                color: "#cbd5e1",
                                fontSize: "10px",
                                lineHeight: 1.55,
                                marginTop: "6px",
                              }}
                            >
                              • {item}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  <div

                    style={{

                      marginTop: "18px",

                      paddingTop: "18px",

                      borderTop: "1px solid #1e293b",

                    }}

                  >

                    <div

                      style={{

                        display: "flex",

                        justifyContent: "space-between",

                        alignItems: "center",

                        gap: "10px",

                        marginBottom: "10px",

                      }}

                    >

                      <strong

                        style={{

                          color: "#f8fafc",

                          fontSize: "13px",

                        }}

                      >

                        Internal Link Recommendations

                      </strong>

                      {internalLinkCandidateCount > 0 && (

                        <span

                          style={{

                            color: "#64748b",

                            fontSize: "10px",

                          }}

                        >

                          {internalLinkCandidateCount} articles checked

                        </span>

                      )}

                    </div>

                    <button

                      type="button"

                      onClick={findInternalLinkRecommendations}

                      disabled={internalLinksLoading}

                      style={{

                        width: "100%",

                        border: "1px solid #0ea5e9",

                        borderRadius: "8px",

                        padding: "10px",

                        background: "#082f49",

                        color: "#e0f2fe",

                        fontWeight: 900,

                        cursor: internalLinksLoading ? "not-allowed" : "pointer",

                        opacity: internalLinksLoading ? 0.65 : 1,

                        marginBottom: "12px",

                      }}

                    >

                      {internalLinksLoading

                        ? "Finding Relevant Articles..."

                        : "Find Internal Links"}

                    </button>

                    {internalLinksError && (

                      <div

                        style={{

                          padding: "10px",

                          borderRadius: "8px",

                          background: "rgba(127,29,29,.3)",

                          border: "1px solid rgba(248,113,113,.3)",

                          color: "#fca5a5",

                          fontSize: "12px",

                          marginBottom: "12px",

                        }}

                      >

                        {internalLinksError}

                      </div>

                    )}

                    {!internalLinksLoading &&

                      !internalLinksError &&

                      internalLinkCandidateCount > 0 &&

                      internalLinkRecommendations.length === 0 && (

                        <div

                          style={{

                            padding: "10px",

                            borderRadius: "8px",

                            background: "#020617",

                            border: "1px solid #1e293b",

                            color: "#94a3b8",

                            fontSize: "12px",

                            lineHeight: 1.5,

                            marginBottom: "12px",

                          }}

                        >

                          No sufficiently relevant published article was found

                          for the current draft.

                        </div>

                      )}

                    {internalLinkInsertMessage && (

                      <div

                        style={{

                          padding: "10px",

                          borderRadius: "8px",

                          background: "rgba(20,83,45,.35)",

                          border: "1px solid rgba(34,197,94,.3)",

                          color: "#86efac",

                          fontSize: "11px",

                          lineHeight: 1.5,

                          marginBottom: "12px",

                        }}

                      >

                        {internalLinkInsertMessage}

                      </div>

                    )}

                    {internalLinkRecommendations.map((item) => (

                      <div

                        key={item.articleId}

                        style={{

                          background: "#020617",

                          border: "1px solid #1e293b",

                          borderRadius: "9px",

                          padding: "12px",

                          marginBottom: "9px",

                        }}

                      >

                        <div

                          style={{

                            display: "flex",

                            justifyContent: "space-between",

                            gap: "10px",

                            alignItems: "flex-start",

                            marginBottom: "7px",

                          }}

                        >

                          <strong

                            style={{

                              color: "#e2e8f0",

                              fontSize: "12px",

                              lineHeight: 1.4,

                            }}

                          >

                            {item.title}

                          </strong>

                          <span

                            style={{

                              color:

                                item.relevance >= 80

                                  ? "#86efac"

                                  : item.relevance >= 50

                                    ? "#fcd34d"

                                    : "#93c5fd",

                              fontSize: "11px",

                              fontWeight: 900,

                              whiteSpace: "nowrap",

                            }}

                          >

                            {item.relevance}%

                          </span>

                        </div>

                        <div

                          style={{

                            color: "#64748b",

                            fontSize: "11px",

                            overflowWrap: "anywhere",

                            marginBottom: "7px",

                          }}

                        >

                          /{item.slug}

                        </div>

                        <div

                          style={{

                            display: "flex",

                            gap: "6px",

                            flexWrap: "wrap",

                            alignItems: "center",

                            fontSize: "11px",

                            marginBottom: "7px",

                          }}

                        >

                          <span style={{ color: "#94a3b8" }}>

                            Best word/phrase to link:

                          </span>

                          <strong

                            style={{

                              color: item.anchor ? "#7dd3fc" : "#fca5a5",

                            }}

                          >

                            {item.anchor || "No exact phrase found in draft"}

                          </strong>

                        </div>

                        {item.context && (

                          <div

                            style={{

                              padding: "9px 10px",

                              borderRadius: "7px",

                              background: "#0f172a",

                              border: "1px solid #1e293b",

                              color: "#cbd5e1",

                              fontSize: "11px",

                              lineHeight: 1.55,

                              marginBottom: "8px",

                            }}

                          >

                            <span

                              style={{

                                color: "#64748b",

                                fontWeight: 800,

                              }}

                            >

                              Place link here:{" "}

                            </span>

                            {item.context}

                          </div>

                        )}

                        {item.anchorOptions &&

                          item.anchorOptions.length > 1 && (

                            <div

                              style={{

                                color: "#64748b",

                                fontSize: "10px",

                                lineHeight: 1.5,

                                marginBottom: "8px",

                              }}

                            >

                              Other matching anchors:{" "}

                              {item.anchorOptions

                                .slice(1)

                                .join(" · ")}

                            </div>

                          )}

                        <div

                          style={{

                            display: "flex",

                            justifyContent: "space-between",

                            alignItems: "center",

                            gap: "8px",

                            flexWrap: "wrap",

                            marginTop: "8px",

                          }}

                        >

                          <span

                            style={{

                              color: item.canInsertAutomatically

                                ? "#86efac"

                                : "#fcd34d",

                              fontSize: "10px",

                              fontWeight: 800,

                            }}

                          >

                            {insertedInternalLinks.includes(item.articleId)

                              ? "Inserted into editor"

                              : item.canInsertAutomatically

                                ? "Ready for automatic insertion"

                                : "Manual anchor selection needed"}

                          </span>

                          <button

                            type="button"

                            onClick={() =>

                              insertRecommendedInternalLink(item)

                            }

                            disabled={

                              !item.canInsertAutomatically ||

                              insertedInternalLinks.includes(

                                item.articleId

                              )

                            }

                            style={{

                              border: "1px solid #22c55e",

                              borderRadius: "7px",

                              padding: "7px 10px",

                              background:

                                insertedInternalLinks.includes(

                                  item.articleId

                                )

                                  ? "#14532d"

                                  : "#052e16",

                              color: "#bbf7d0",

                              fontSize: "10px",

                              fontWeight: 900,

                              cursor:

                                !item.canInsertAutomatically ||

                                insertedInternalLinks.includes(

                                  item.articleId

                                )

                                  ? "not-allowed"

                                  : "pointer",

                              opacity:

                                !item.canInsertAutomatically ? 0.5 : 1,

                            }}

                          >

                            {insertedInternalLinks.includes(item.articleId)

                              ? "Inserted"

                              : "Insert Link"}

                          </button>

                        </div>

                      </div>

                    ))}

                  </div>

                  <button type="button" onClick={analyzeDraftSeo} disabled={seoAnalyzing} style={{ width: "100%", marginTop: "8px", border: "1px solid #334155", borderRadius: "8px", padding: "10px", background: "#0f172a", color: "#cbd5e1", fontWeight: 800, cursor: seoAnalyzing ? "not-allowed" : "pointer", opacity: seoAnalyzing ? 0.65 : 1 }}>

                    {seoAnalyzing ? "Analyzing..." : "Run Analysis Again"}

                  </button>

                </div>

              )}

            </Section>

          </div>

        </div>

        <style>{`

          [contenteditable="true"] h2 {
            font-size: 30px;
            line-height: 1.3;
            margin: 28px 0 14px;
            font-weight: 800;
            color: #0f172a;
          }

          [contenteditable="true"] h3 {
            font-size: 24px;
            line-height: 1.35;
            margin: 24px 0 12px;
            font-weight: 800;
            color: #1e293b;
          }

          [contenteditable="true"] strong,
          [contenteditable="true"] b {
            font-weight: 800;
            color: #020617;
          }

          [contenteditable="true"] em,
          [contenteditable="true"] i {
            font-style: italic;
          }

          [contenteditable="true"] a {
            color: #2563eb;
            text-decoration: underline;
            font-weight: 600;
          }

          [contenteditable="true"] blockquote {
            margin: 22px 0;
            padding: 14px 18px;
            border-left: 4px solid #3b82f6;
            background: #f8fafc;
            color: #334155;
            font-style: italic;
          }

          [contenteditable="true"] img {
            max-width: 100%;
            height: auto;
            border-radius: 10px;
            margin: 18px 0;
          }

          [contenteditable="true"] ul,
          [contenteditable="true"] ol {
            padding-left: 28px;
            margin: 16px 0;
          }

          [contenteditable="true"] li {
            margin: 6px 0;
          }

          [contenteditable="true"] code {
            font-family: Consolas, "Courier New", monospace;
            background: #f1f5f9;
            color: #be123c;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: .92em;
          }

          [contenteditable="true"] hr {
            border: 0;
            border-top: 1px solid #cbd5e1;
            margin: 28px 0;
          }

          [contenteditable="true"] .coinlytx-table-wrap {
            overflow-x: auto;
            margin: 22px 0;
          }

          [contenteditable="true"] table {
            width: 100%;
            border-collapse: collapse;
            background: #ffffff;
          }

          [contenteditable="true"] th,
          [contenteditable="true"] td {
            border: 1px solid #cbd5e1;
            padding: 10px 12px;
            text-align: left;
            vertical-align: top;
          }

          [contenteditable="true"] th {
            background: #f1f5f9;
            font-weight: 800;
          }

          @media (max-width: 850px) {

            .edit-grid {

              grid-template-columns: 1fr !important;

            }

          }

        `}</style>

      </div>

    </main>

  );

}

function SeoScore({ label, score }: { label: string; score: number }) {

  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#f87171";

  return (

    <div style={{ background: "#020617", border: "1px solid #1e293b", borderRadius: "9px", padding: "12px" }}>

      <div style={{ color: "#64748b", fontSize: "10px", fontWeight: 800, marginBottom: "5px", textTransform: "uppercase" }}>{label}</div>

      <div style={{ color, fontSize: "21px", fontWeight: 900 }}>{score}<span style={{ color: "#475569", fontSize: "11px" }}>/100</span></div>

    </div>

  );

}

function SeoStat({ label, value }: { label: string; value: number }) {

  return <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "5px 0", fontSize: "12px" }}><span style={{ color: "#94a3b8" }}>{label}</span><strong style={{ color: "#f8fafc" }}>{value}</strong></div>;

}

function SeoCheckGroup({ title, items, type }: { title: string; items: string[]; type: "critical" | "warning" | "passed" }) {

  const color = type === "passed" ? "#86efac" : type === "warning" ? "#fcd34d" : "#fca5a5";

  const symbol = type === "passed" ? "✓" : type === "warning" ? "!" : "×";

  return (

    <div style={{ marginBottom: "16px" }}>

      <div style={{ color, fontSize: "11px", fontWeight: 900, textTransform: "uppercase", marginBottom: "7px" }}>{title}</div>

      {items.map((item, index) => <div key={`${type}-${index}`} style={{ display: "flex", gap: "8px", alignItems: "flex-start", color: "#cbd5e1", fontSize: "12px", lineHeight: 1.5, marginBottom: "7px" }}><span style={{ color, fontWeight: 900 }}>{symbol}</span><span>{item}</span></div>)}

    </div>

  );

}

function Section({ children }: { children: React.ReactNode }) {

  return <section style={sectionStyle}>{children}</section>;

}

function FieldLabel({ children }: { children: React.ReactNode }) {

  return <label style={fieldLabelStyle}>{children}</label>;

}

function Counter({ value, max }: { value: number; max: number }) {

  return (

    <div

      style={{

        marginTop: "-12px",

        marginBottom: "15px",

        color: value >= max ? "#f59e0b" : "#64748b",

        fontSize: "11px",

        textAlign: "right",

      }}

    >

      {value}/{max}

    </div>

  );

}

function StatusBadge({ status }: { status: string }) {

  const published = status === "published";

  return (

    <span

      style={{

        padding: "5px 10px",

        borderRadius: "999px",

        background: published ? "rgba(34,197,94,.12)" : "rgba(245,158,11,.12)",

        border: published

          ? "1px solid rgba(34,197,94,.3)"

          : "1px solid rgba(245,158,11,.3)",

        color: published ? "#86efac" : "#fcd34d",

        textTransform: "capitalize",

        fontSize: "12px",

        fontWeight: 800,

      }}

    >

      {status}

    </span>

  );

}

function Message({

  children,

  type,

}: {

  children: React.ReactNode;

  type: "error" | "success";

}) {

  const ok = type === "success";

  return (

    <div

      style={{

        padding: "12px",

        marginBottom: "15px",

        borderRadius: "8px",

        background: ok ? "rgba(20,83,45,.35)" : "rgba(127,29,29,.3)",

        border: ok

          ? "1px solid rgba(34,197,94,.3)"

          : "1px solid rgba(248,113,113,.3)",

        color: ok ? "#86efac" : "#fca5a5",

        fontSize: "13px",

      }}

    >

      {children}

    </div>

  );

}

const pageStyle: React.CSSProperties = {

  minHeight: "100vh",

  background: "#020617",

  color: "#f8fafc",

  padding: "32px 18px 100px",

};

const loadingStyle: React.CSSProperties = {

  minHeight: "100vh",

  background: "#020617",

  color: "#f8fafc",

  display: "flex",

  alignItems: "center",

  justifyContent: "center",

};

const headerStyle: React.CSSProperties = {

  display: "flex",

  justifyContent: "space-between",

  alignItems: "flex-start",

  gap: "20px",

  flexWrap: "wrap",

  marginBottom: "30px",

};

const eyebrowStyle: React.CSSProperties = {

  color: "#22c55e",

  fontSize: "13px",

  fontWeight: 900,

  letterSpacing: ".06em",

};

const backLinkStyle: React.CSSProperties = {

  padding: "11px 15px",

  borderRadius: "9px",

  border: "1px solid #334155",

  color: "#e2e8f0",

  textDecoration: "none",

  fontWeight: 800,

};

const gridStyle: React.CSSProperties = {

  display: "grid",

  gridTemplateColumns: "minmax(0, 2fr) minmax(300px, 1fr)",

  gap: "22px",

  alignItems: "start",

};

const sectionStyle: React.CSSProperties = {

  background: "#0f172a",

  border: "1px solid #1e293b",

  borderRadius: "14px",

  padding: "24px",

  marginBottom: "22px",

};

const sectionTitleStyle: React.CSSProperties = {

  fontSize: "18px",

  margin: "0 0 20px",

};

const fieldLabelStyle: React.CSSProperties = {

  display: "block",

  marginBottom: "8px",

  color: "#e2e8f0",

  fontSize: "13px",

  fontWeight: 800,

};

const inputStyle: React.CSSProperties = {

  width: "100%",

  boxSizing: "border-box",

  background: "#020617",

  color: "#f8fafc",

  border: "1px solid #334155",

  borderRadius: "9px",

  padding: "13px 14px",

  outline: "none",

  marginBottom: "18px",

  fontSize: "14px",

};

const urlPreviewStyle: React.CSSProperties = {

  marginTop: "-10px",

  marginBottom: "18px",

  color: "#64748b",

  fontSize: "12px",

  overflowWrap: "anywhere",

};

const sectionHeaderStyle: React.CSSProperties = {

  display: "flex",

  justifyContent: "space-between",

  alignItems: "center",

  gap: "10px",

  marginBottom: "12px",

};

const editorModeSwitchRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  marginBottom: "8px",
};

const editorModeTabsStyle: React.CSSProperties = {
  display: "flex",
  gap: "6px",
};

const editorModeTabStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "6px",
  padding: "7px 12px",
  background: "#ffffff",
  color: "#475569",
  fontWeight: 800,
  cursor: "pointer",
};

const editorModeTabActiveStyle: React.CSSProperties = {
  background: "#2563eb",
  borderColor: "#2563eb",
  color: "#ffffff",
};

const editorModeHintStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "11px",
};

const htmlSourceStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "520px",
  border: "1px solid #cbd5e1",
  borderTop: 0,
  borderRadius: "0 0 10px 10px",
  outline: 0,
  background: "#0f172a",
  color: "#e2e8f0",
  padding: "22px",
  fontSize: "14px",
  lineHeight: 1.7,
  boxSizing: "border-box",
  fontFamily: "Consolas, 'Courier New', monospace",
  resize: "vertical",
};

const htmlWarningStyle: React.CSSProperties = {
  marginTop: "8px",
  color: "#f59e0b",
  fontSize: "11px",
  lineHeight: 1.5,
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  padding: "12px",
  border: "1px solid #dbe3ee",
  borderBottom: "1px solid #cbd5e1",
  borderRadius: "10px 10px 0 0",
  background: "#f8fafc",
};

const toolbarButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: 700,
  boxShadow: "0 1px 2px rgba(15,23,42,.06)",
};

const toolbarHelpStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "11px",
  lineHeight: 1.5,
  padding: "8px 10px",
  background: "#ffffff",
  borderLeft: "1px solid #dbe3ee",
  borderRight: "1px solid #dbe3ee",
};

const editorMessageStyle: React.CSSProperties = {
  marginTop: "12px",
  padding: "10px 12px",
  borderRadius: "8px",
  background: "rgba(20,83,45,.35)",
  border: "1px solid rgba(34,197,94,.3)",
  color: "#86efac",
  fontSize: "12px",
};

const smallUtilityButtonStyle: React.CSSProperties = {
  border: "1px solid #334155",
  borderRadius: "7px",
  background: "#020617",
  color: "#93c5fd",
  padding: "6px 9px",
  fontSize: "10px",
  fontWeight: 800,
  cursor: "pointer",
};

const categoryWarningStyle: React.CSSProperties = {
  marginTop: "-8px",
  marginBottom: "16px",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid rgba(245,158,11,.3)",
  background: "rgba(120,53,15,.22)",
  color: "#fcd34d",
  fontSize: "11px",
  lineHeight: 1.5,
};

const categoryCountStyle: React.CSSProperties = {
  marginTop: "-9px",
  marginBottom: "16px",
  color: "#64748b",
  fontSize: "10px",
};

const contentStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "520px",
  border: "1px solid #dbe3ee",
  borderTop: 0,
  borderRadius: "0 0 10px 10px",
  outline: 0,
  background: "#ffffff",
  color: "#111827",
  padding: "28px",
  fontSize: "17px",
  lineHeight: 1.8,
  boxSizing: "border-box",
  fontFamily: "Georgia, 'Times New Roman', serif",
  whiteSpace: "pre-wrap",
  overflowWrap: "break-word",
};

const imagePreviewBoxStyle: React.CSSProperties = {

  width: "100%",

  aspectRatio: "16 / 9",

  overflow: "hidden",

  borderRadius: "10px",

  border: "1px solid #334155",

  background: "#020617",

  marginBottom: "18px",

};

const imagePreviewStyle: React.CSSProperties = {

  width: "100%",

  height: "100%",

  objectFit: "cover",

  display: "block",

};

const emptyImageStyle: React.CSSProperties = {

  width: "100%",

  aspectRatio: "16 / 9",

  borderRadius: "10px",

  border: "1px dashed #334155",

  background: "#020617",

  color: "#64748b",

  display: "flex",

  alignItems: "center",

  justifyContent: "center",

  marginBottom: "18px",

  fontSize: "13px",

};

const imageErrorStyle: React.CSSProperties = {

  ...emptyImageStyle,

  color: "#fca5a5",

  border: "1px dashed rgba(248,113,113,.45)",

  padding: "20px",

  boxSizing: "border-box",

  textAlign: "center",

};

const publishingRowStyle: React.CSSProperties = {

  display: "flex",

  justifyContent: "space-between",

  alignItems: "center",

  gap: "10px",

  marginBottom: "12px",

};

const publishedDateStyle: React.CSSProperties = {

  color: "#64748b",

  fontSize: "12px",

  marginBottom: "18px",

  lineHeight: 1.5,

};

const secondaryButtonStyle: React.CSSProperties = {

  width: "100%",

  border: "1px solid #475569",

  borderRadius: "10px",

  padding: "14px",

  background: "#1e293b",

  color: "#f8fafc",

  fontSize: "14px",

  fontWeight: 900,

  marginBottom: "10px",

};

const publishButtonStyle: React.CSSProperties = {

  width: "100%",

  border: 0,

  borderRadius: "10px",

  padding: "14px",

  color: "#052e16",

  fontSize: "15px",

  fontWeight: 900,

};

const viewArticleStyle: React.CSSProperties = {

  display: "block",

  textAlign: "center",

  marginTop: "14px",

  color: "#60a5fa",

  textDecoration: "none",

  fontSize: "13px",

  fontWeight: 700,

};

const seoAgentTextStyle: React.CSSProperties = {

  color: "#64748b",

  lineHeight: 1.6,

  fontSize: "13px",

  marginBottom: 0,

};

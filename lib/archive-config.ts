export type ArchiveKey =
  | "press-release"
  | "crypto-news"
  | "price-analysis"
  | "learn"
  | "sponsored"
  | "global-trending";

export type ArchiveConfig = {
  slug: ArchiveKey;
  title: string;
  description: string;
  categorySlug: string;
  accent: string;
  label: string;
};

export const archiveConfigs: Record<ArchiveKey, ArchiveConfig> = {
  "press-release": {
    slug: "press-release",
    title: "Press Release",
    description:
      "Latest announcements, company updates and developments from crypto, blockchain and Web3 companies.",
    categorySlug: "press-release",
    accent: "blue",
    label: "PRESS RELEASE",
  },

  "crypto-news": {
    slug: "crypto-news",
    title: "Crypto News",
    description:
      "Latest cryptocurrency news, market developments, Bitcoin updates, blockchain stories and Web3 coverage.",
    categorySlug: "crypto-news",
    accent: "cyan",
    label: "CRYPTO NEWS",
  },

  "price-analysis": {
    slug: "price-analysis",
    title: "Price Analysis",
    description:
      "Cryptocurrency price analysis, technical insights, market trends and analysis covering Bitcoin, Ethereum and altcoins.",
    categorySlug: "price-analysis",
    accent: "purple",
    label: "PRICE ANALYSIS",
  },

  learn: {
    slug: "learn",
    title: "Learn Crypto & Web3",
    description:
      "Beginner guides, cryptocurrency explainers and educational resources covering Bitcoin, blockchain, wallets, DeFi and Web3.",
    categorySlug: "learn",
    accent: "blue",
    label: "LEARN",
  },

  sponsored: {
    slug: "sponsored",
    title: "Sponsored",
    description:
      "Featured projects, partnerships and promotional content from companies across the cryptocurrency and Web3 ecosystem.",
    categorySlug: "sponsored",
    accent: "orange",
    label: "SPONSORED",
  },

  "global-trending": {
    slug: "global-trending",
    title: "Global Trending",
    description:
      "Trending cryptocurrency stories and important blockchain developments from markets around the world.",
    categorySlug: "global-trending",
    accent: "teal",
    label: "GLOBAL TRENDING",
  },
};
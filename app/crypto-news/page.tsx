import type { Metadata } from "next";

import ArchivePage from "../../components/ArchivePage";
import { getArchivePosts } from "../../lib/wordpress";
import { archiveConfigs } from "../../lib/archive-config";

const config = archiveConfigs["crypto-news"];

export const metadata: Metadata = {
  title: "Latest Crypto News, Bitcoin & Blockchain News",

  description:
    "Read the latest crypto news, Bitcoin and Ethereum updates, blockchain developments, altcoin news, Web3 stories and cryptocurrency market updates on CoinlytX.",

  alternates: {
    canonical: "https://coinlytx.com/crypto-news/",
  },

  openGraph: {
    title:
      "Latest Crypto News, Bitcoin & Blockchain News | CoinlytX",

    description:
      "Latest cryptocurrency news, Bitcoin updates, blockchain developments, altcoin stories and Web3 coverage.",

    url: "https://coinlytx.com/crypto-news/",

    siteName: "CoinlytX",

    type: "website",
  },

  twitter: {
    card: "summary_large_image",

    title:
      "Latest Crypto News, Bitcoin & Blockchain News | CoinlytX",

    description:
      "Follow the latest cryptocurrency, Bitcoin, blockchain and Web3 news on CoinlytX.",
  },

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default async function CryptoNewsPage() {
  const result = await getArchivePosts(
    config.categorySlug,
    1,
    12
  );

  return (
    <ArchivePage
      config={config}
      posts={result.posts}
      currentPage={1}
      totalPages={result.totalPages}
      totalPosts={result.totalPosts}
    />
  );
}
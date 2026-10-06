import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ArchivePage from "../../components/ArchivePage";

import {
  getArchivePosts,
} from "../../lib/wordpress";

import {
  archiveConfigs,
} from "../../lib/archive-config";


const config =
  archiveConfigs["press-release"];


/* =========================================================
   SEO METADATA
========================================================= */

export const metadata: Metadata = {
  title:
    "Crypto Press Releases & Blockchain Announcements",

  description:
    "Read the latest crypto press releases, blockchain announcements, Web3 company updates, exchange news and cryptocurrency industry developments on CoinlytX.",

  alternates: {
    canonical:
      "https://coinlytx.com/press-release/",
  },

  openGraph: {
    title:
      "Crypto Press Releases & Blockchain Announcements | CoinlytX",

    description:
      "Latest cryptocurrency press releases, blockchain announcements, Web3 company updates and industry developments.",

    url:
      "https://coinlytx.com/press-release/",

    siteName: "CoinlytX",

    type: "website",
  },

  twitter: {
    card: "summary_large_image",

    title:
      "Crypto Press Releases & Blockchain Announcements | CoinlytX",

    description:
      "Latest crypto press releases, blockchain announcements and Web3 industry updates from CoinlytX.",
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


/* =========================================================
   PRESS RELEASE PAGE
========================================================= */

export default async function PressReleasePage() {
  const result = await getArchivePosts(
    config.categorySlug,
    1,
    12
  );

  /*
   * The archive itself should exist even when there
   * aren't any posts, so we don't 404 page 1.
   */

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
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import ArchivePage from "../../../../components/ArchivePage";
import { getArchivePosts } from "../../../../lib/wordpress";
import { archiveConfigs } from "../../../../lib/archive-config";

const config = archiveConfigs["crypto-news"];

type PageProps = {
  params: Promise<{
    page: string;
  }>;
};

/* =========================================================
   DYNAMIC SEO METADATA
========================================================= */

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { page } = await params;

  const pageNumber = Number(page);

  if (
    !Number.isInteger(pageNumber) ||
    pageNumber < 2
  ) {
    return {};
  }

  const canonical =
    `https://coinlytx.com/crypto-news/page/${pageNumber}/`;

  return {
    title: `Latest Crypto News - Page ${pageNumber}`,

    description:
      `Browse page ${pageNumber} of CoinlytX crypto news covering Bitcoin, Ethereum, blockchain, altcoins, Web3 and cryptocurrency market developments.`,

    alternates: {
      canonical,
    },

    openGraph: {
      title:
        `Latest Crypto News - Page ${pageNumber} | CoinlytX`,

      description:
        "Latest cryptocurrency news, Bitcoin and Ethereum updates, blockchain developments and Web3 stories.",

      url: canonical,

      siteName: "CoinlytX",

      type: "website",
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
}

/* =========================================================
   PAGINATED CRYPTO NEWS
========================================================= */

export default async function CryptoNewsPaginationPage({
  params,
}: PageProps) {
  const { page } = await params;

  const pageNumber = Number(page);

  /* Invalid URL */

  if (
    !Number.isInteger(pageNumber) ||
    pageNumber < 1
  ) {
    notFound();
  }

  /* Prevent duplicate page 1 */

  if (pageNumber === 1) {
    redirect("/crypto-news/");
  }

  /* Fetch this page directly from WordPress */

  const result = await getArchivePosts(
    config.categorySlug,
    pageNumber,
    12
  );

  /* Invalid/out-of-range pagination */

  if (
    result.posts.length === 0 ||
    result.totalPages === 0 ||
    pageNumber > result.totalPages
  ) {
    notFound();
  }

  return (
    <ArchivePage
      config={config}
      posts={result.posts}
      currentPage={pageNumber}
      totalPages={result.totalPages}
      totalPosts={result.totalPosts}
    />
  );
}
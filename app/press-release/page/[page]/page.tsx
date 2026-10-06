import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import ArchivePage from "../../../../components/ArchivePage";
import { getArchivePosts } from "../../../../lib/wordpress";
import { archiveConfigs } from "../../../../lib/archive-config";

const config = archiveConfigs["press-release"];

type PageProps = {
  params: Promise<{
    page: string;
  }>;
};

/* =========================================================
   SEO METADATA FOR PAGE 2, PAGE 3, ETC.
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
    `https://coinlytx.com/press-release/page/${pageNumber}/`;

  return {
    title:
      `Crypto Press Releases - Page ${pageNumber}`,

    description:
      `Browse page ${pageNumber} of CoinlytX crypto press releases, blockchain announcements, Web3 company updates and cryptocurrency industry news.`,

    alternates: {
      canonical,
    },

    openGraph: {
      title:
        `Crypto Press Releases - Page ${pageNumber} | CoinlytX`,

      description:
        `Browse more cryptocurrency press releases, blockchain announcements and Web3 industry updates on CoinlytX.`,

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
   PAGINATED PRESS RELEASE PAGE
========================================================= */

export default async function PressReleasePaginationPage({
  params,
}: PageProps) {
  const { page } = await params;

  const pageNumber = Number(page);

  /* Invalid page */

  if (
    !Number.isInteger(pageNumber) ||
    pageNumber < 1
  ) {
    notFound();
  }

  /*
   * /press-release/page/1/
   * should never compete with:
   * /press-release/
   */

  if (pageNumber === 1) {
    redirect("/press-release/");
  }

  const result = await getArchivePosts(
    config.categorySlug,
    pageNumber,
    12
  );

  /*
   * If WordPress only has 3 pages and someone opens
   * /page/999/, return a real 404.
   */

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
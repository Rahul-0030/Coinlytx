import type { MetadataRoute } from "next";

const SITE_URL = "https://coinlytx.com";
const WP_URL =
  process.env.NEXT_PUBLIC_WP_URL || "https://cms.coinlytx.com";

type WPPost = {
  slug: string;
  modified: string;
};

async function getAllPosts(): Promise<WPPost[]> {
  try {
    const posts: WPPost[] = [];
    let page = 1;

    while (true) {
      const response = await fetch(
        `${WP_URL}/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=slug,modified`,
        {
          next: {
            revalidate: 3600,
          },
        }
      );

      // WordPress returns 400 when page number is higher
      // than the total available pages.
      if (response.status === 400) break;

      if (!response.ok) {
        console.error("Sitemap WordPress error:", response.status);
        break;
      }

      const data: WPPost[] = await response.json();

      if (!data.length) break;

      posts.push(...data);

      if (data.length < 100) break;

      page++;
    }

    return posts;
  } catch (error) {
    console.error("Unable to generate WordPress sitemap:", error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/crypto-news`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/press-release`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/learn`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/about-us`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/${post.slug}`,
    lastModified: new Date(post.modified),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticPages, ...postPages];
}
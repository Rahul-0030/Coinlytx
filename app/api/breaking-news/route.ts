import { NextResponse } from "next/server";

export async function GET() {
  try {
    const wpUrl =
      process.env.NEXT_PUBLIC_WP_URL ||
      "https://cms.coinlytx.com";

    const url =
      `${wpUrl}/wp-json/wp/v2/posts?per_page=5&_fields=id,slug,link,date,title,excerpt`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Coinlytx/1.0 (+https://coinlytx.com)",
      },
    });

    if (!response.ok) {
      const body = await response.text();

      console.error(
        `WordPress request failed ${response.status}:`,
        body.slice(0, 500)
      );

      return NextResponse.json(
        {
          success: false,
          message: `WordPress returned ${response.status}`,
        },
        { status: 502 }
      );
    }

    const posts = await response.json();

    return NextResponse.json(posts, {
      headers: {
        "Cache-Control":
          "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Breaking news API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load breaking news",
      },
      { status: 500 }
    );
  }
}
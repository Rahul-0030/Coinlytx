import type { Config } from "@netlify/functions";

export default async () => {
  const siteUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!siteUrl) {
    console.error("Netlify URL environment variable is missing.");
    return;
  }

  if (!cronSecret) {
    console.error("CRON_SECRET environment variable is missing.");
    return;
  }

  const endpoint = `${siteUrl}/api/trading/oi/snapshot`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        Accept: "application/json",
      },
    });

    const body = await response.text();

    if (!response.ok) {
      console.error(
        `OI snapshot collector failed: ${response.status} ${body}`
      );
      return;
    }

    console.log("OI snapshot collection successful:", body);
  } catch (error) {
    console.error("OI snapshot scheduled function error:", error);
  }
};

export const config: Config = {
  schedule: "*/5 * * * *",
};
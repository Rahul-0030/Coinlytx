import { existsSync, readFileSync } from "node:fs";
import { bindings, defineConfig, defineWorker } from "cf/config";
import { createWorkersResponseStoreServiceBindingConfig } from "@vinext/cloudflare/cache/config";

function getEnv(name: string): string {
  if (process.env[name]) {
    return process.env[name]!;
  }

  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;

    const text = readFileSync(file, "utf8");

    const line = text
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(`${name}=`));

    if (line) {
      return line.slice(name.length + 1).trim();
    }
  }

  throw new Error(`Missing required environment variable: ${name}`);
}

const responseStore =
  await createWorkersResponseStoreServiceBindingConfig({
    worker: {
      name: "coinlytx-response-store",
      compatibilityDate: "2026-10-22",
      compatibilityFlags: ["nodejs_compat"],
    },
    bucket: "coinlytx-response-store-cache-bodies",
  });

export const responseStoreServiceBinding =
  responseStore.serviceBindingWorker;

export default defineConfig({
  worker: defineWorker({
    ...responseStore.applicationWorker,

    name: "coinlytx",

    entrypoint: "vinext/server/fetch-handler",

    compatibilityDate: "2026-10-22",

    compatibilityFlags: ["nodejs_compat"],

    domains: [
      "coinlytx.com",
      "www.coinlytx.com",
    ],

    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: [
        "/*",
        "!/_next/static/*",
        "!/*/_next/static/*",
      ],
    },

    env: {
      ...responseStore.applicationWorker.env,

      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),

      NEXT_PUBLIC_SUPABASE_URL:
        bindings.text(
          getEnv("NEXT_PUBLIC_SUPABASE_URL")
        ),

      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        bindings.text(
          getEnv(
            "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
          )
        ),

      NEXT_PUBLIC_WP_URL:
        bindings.text(
          getEnv("NEXT_PUBLIC_WP_URL")
        ),

      COINGECKO_API_KEY:
        bindings.secret(),

      CRON_SECRET:
        bindings.secret(),

      SUPABASE_SERVICE_ROLE_KEY:
        bindings.secret(),
    },
  }),
});

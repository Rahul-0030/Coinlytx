import Hero3D from "../components/Hero3D";
import LiveCryptoMarket from "../components/LiveCryptoMarket";
import FeaturedNewsCards from "../components/FeaturedNewsCards";
import PressReleaseCarousel from "../components/PressReleaseCarousel";
import CryptoNewsShowcase from "../components/CryptoNewsShowcase";
import GlobalTrendingSection from "../components/GlobalTrending";
import SponsoredShowcase from "../components/SponsoredShowcase";
import EditorialNewsGrid from "../components/EditorialNewsGrid";

import {
  getLatestPosts,
  getPressReleasePosts,
  getCryptoNewsPosts,
  getGlobalTrendingPosts,
  getSponsoredPosts,
  getLearnPosts,
  getPriceAnalysisPosts,
  type WordPressPost,
} from "../lib/wordpress";

export default async function Home() {
  let latestPosts: WordPressPost[] = [];
  let pressReleasePosts: WordPressPost[] = [];
  let cryptoNewsPosts: WordPressPost[] = [];
  let globalTrendingPosts: WordPressPost[] = [];
  let sponsoredPosts: WordPressPost[] = [];
  let learnPosts: WordPressPost[] = [];
  let priceAnalysisPosts: WordPressPost[] = [];

  /* =========================================================
     LOAD LATEST POSTS
  ========================================================= */

  try {
    latestPosts = await getLatestPosts(9);
  } catch (error) {
    console.error(
      "Unable to load CoinlytX homepage posts:",
      error
    );
  }

  /* =========================================================
     LOAD PRESS RELEASES
  ========================================================= */

  try {
    pressReleasePosts = await getPressReleasePosts(7);
  } catch (error) {
    console.error(
      "Unable to load CoinlytX press releases:",
      error
    );
  }

  /* =========================================================
     LOAD CRYPTO NEWS
  ========================================================= */

  try {
    cryptoNewsPosts = await getCryptoNewsPosts(8);
  } catch (error) {
    console.error(
      "Unable to load CoinlytX Crypto News:",
      error
    );
  }

  /* =========================================================
     LOAD GLOBAL TRENDING
  ========================================================= */

  try {
    globalTrendingPosts = await getGlobalTrendingPosts(8);
  } catch (error) {
    console.error(
      "Unable to load CoinlytX Global Trending posts:",
      error
    );
  }

  /* =========================================================
     LOAD SPONSORED POSTS
  ========================================================= */

  try {
    sponsoredPosts = await getSponsoredPosts(6);
  } catch (error) {
    console.error(
      "Unable to load CoinlytX Sponsored posts:",
      error
    );
  }

  /* =========================================================
     LOAD LEARN POSTS
  ========================================================= */

  try {
    learnPosts = await getLearnPosts(15);
  } catch (error) {
    console.error(
      "Unable to load CoinlytX Learn posts:",
      error
    );
  }

  /* =========================================================
     LOAD PRICE ANALYSIS
  ========================================================= */

  try {
    priceAnalysisPosts = await getPriceAnalysisPosts(15);
  } catch (error) {
    console.error(
      "Unable to load CoinlytX Price Analysis posts:",
      error
    );
  }

  return (
    <>
      {/* =====================================================
          1. HERO
      ====================================================== */}

      <Hero3D />

      {/* =====================================================
          2. LIVE CRYPTO MARKET
      ====================================================== */}

      <LiveCryptoMarket />

      {/* =====================================================
          3. LATEST CRYPTO NEWS
      ====================================================== */}

      {latestPosts.length > 0 && (
        <section className="homepage-news-section">
          <div className="homepage-news-heading">
            <div className="homepage-news-heading-copy">
              <span className="homepage-section-label">
                LATEST FROM COINLYTX
              </span>

              <h2>Latest Crypto News</h2>

              <p className="homepage-news-description">
                Market-moving stories, blockchain developments,
                Web3 trends and the latest from the crypto world.
              </p>
            </div>

            <a
              href="/crypto-news/"
              className="homepage-view-all"
            >
              View All
              <span aria-hidden="true">→</span>
            </a>
          </div>

          <FeaturedNewsCards posts={latestPosts} />
        </section>
      )}

      {/* =====================================================
          4. PRESS RELEASE
      ====================================================== */}

      {pressReleasePosts.length > 0 && (
        <PressReleaseCarousel
          posts={pressReleasePosts}
        />
      )}

      {/* =====================================================
          5. CRYPTO NEWS
      ====================================================== */}

      {cryptoNewsPosts.length > 0 && (
        <CryptoNewsShowcase
          posts={cryptoNewsPosts}
        />
      )}

      {/* =====================================================
          6. GLOBAL TRENDING
      ====================================================== */}

      {globalTrendingPosts.length > 0 && (
  <GlobalTrendingSection
    posts={globalTrendingPosts}
  />
)}

      {/* =====================================================
          7. SPONSORED
      ====================================================== */}

      {sponsoredPosts.length > 0 && (
        <SponsoredShowcase
          posts={sponsoredPosts}
        />
      )}

      {/* =====================================================
          8. LEARN
      ====================================================== */}

      {learnPosts.length > 0 && (
        <EditorialNewsGrid
          title="Learn"
          posts={learnPosts}
          viewAllHref="/learn/"
          variant="learn"
        />
      )}

      {/* =====================================================
          9. PRICE ANALYSIS
      ====================================================== */}

      {priceAnalysisPosts.length > 0 && (
        <EditorialNewsGrid
          title="Price Analysis"
          posts={priceAnalysisPosts}
          viewAllHref="/price-analysis/"
          variant="analysis"
        />
      )}
    </>
  );
}
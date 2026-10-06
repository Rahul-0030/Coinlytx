"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  Send,
} from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function handleNewsletterSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
  }

  return (
    <footer className="cx-footer">

      {/* ================================================
          ANIMATED WEB3 BACKGROUND
      ================================================= */}

      <div
        className="cx-footer-bg"
        aria-hidden="true"
      >
        <div className="cx-footer-stars" />

        <div className="cx-footer-glow cx-footer-glow-one" />
        <div className="cx-footer-glow cx-footer-glow-two" />

        <div className="cx-footer-orbit cx-footer-orbit-one" />
        <div className="cx-footer-orbit cx-footer-orbit-two" />

        {/* DIGITAL GLOBE */}

        <div className="cx-footer-planet">
          <div className="cx-footer-planet-grid" />
          <div className="cx-footer-planet-ring cx-footer-planet-ring-one" />
          <div className="cx-footer-planet-ring cx-footer-planet-ring-two" />
        </div>

        {/* FLOATING CRYPTO COINS */}

        <div className="cx-footer-coin cx-footer-btc">
          ₿
        </div>

        <div className="cx-footer-coin cx-footer-eth">
          ◆
        </div>

        {/* NEON WAVES */}

        <div className="cx-footer-wave cx-footer-wave-one" />
        <div className="cx-footer-wave cx-footer-wave-two" />
        <div className="cx-footer-wave cx-footer-wave-three" />
      </div>

      {/* ================================================
          MAIN FOOTER
      ================================================= */}

      <div className="cx-footer-container">

        {/* ================================================
            BRAND
        ================================================= */}

        <div className="cx-footer-brand">

          <Link
            href="/"
            className="cx-footer-logo"
            aria-label="CoinlytX home"
          >
            <img
              src="/coinlytx-logo.png"
              alt="CoinlytX"
            />
          </Link>

          <div className="cx-footer-tagline">
            <span>NEWS</span>
            <i />
            <span>INSIGHTS</span>
            <i />
            <span>MARKETS</span>
            <i />
            <span>WEB3</span>
          </div>

          <p className="cx-footer-description">
            Your trusted source for crypto news,
            market insights and Web3 developments.
          </p>

          {/* ================================================
              SOCIAL MEDIA
          ================================================= */}

          <div className="cx-footer-socials">

            {/* X */}

            <a
              href="#"
              className="cx-social cx-social-x"
              aria-label="CoinlytX on X"
            >
              <span className="cx-x-symbol">
                𝕏
              </span>
            </a>

            {/* YOUTUBE */}

            <a
              href="#"
              className="cx-social cx-social-youtube"
              aria-label="CoinlytX on YouTube"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z"
                />
              </svg>
            </a>

            {/* TELEGRAM */}

            <a
              href="#"
              className="cx-social cx-social-telegram"
              aria-label="CoinlytX on Telegram"
            >
              <Send
                size={19}
                strokeWidth={2}
              />
            </a>

            {/* LINKEDIN */}

            <a
              href="#"
              className="cx-social cx-social-linkedin"
              aria-label="CoinlytX on LinkedIn"
            >
              <svg
                viewBox="0 0 24 24"
                width="19"
                height="19"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M5.3 7.8H1.1V21h4.2V7.8ZM3.2 1A2.4 2.4 0 1 0 3.2 5.8 2.4 2.4 0 0 0 3.2 1ZM21 13.4c0-4-2.1-5.9-5-5.9-2.3 0-3.4 1.3-4 2.2V7.8H7.8V21H12v-6.5c0-1.7.3-3.4 2.5-3.4 2.2 0 2.2 2 2.2 3.5V21H21v-7.6Z"
                />
              </svg>
            </a>

            {/* INSTAGRAM */}

            <a
              href="#"
              className="cx-social cx-social-instagram"
              aria-label="CoinlytX on Instagram"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm10.5 1.5A1.25 1.25 0 1 1 17.5 8a1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
                />
              </svg>
            </a>

          </div>
        </div>

        {/* ================================================
            EXPLORE
        ================================================= */}

        <div className="cx-footer-column">

          <h3>
            Explore
          </h3>

          <nav aria-label="Footer explore navigation">

            <Link href="/">
              Home
            </Link>

            <Link href="/crypto-news/">
              Crypto News
            </Link>

            <Link href="/press-release/">
              Press Releases
            </Link>

            <Link href="/global-trending/">
              Global Trending
            </Link>

            <Link href="/about/">
              About Us
            </Link>

          </nav>
        </div>

        {/* ================================================
            SUPPORT
        ================================================= */}

        <div className="cx-footer-column">

          <h3>
            Support
          </h3>

          <nav aria-label="Footer support navigation">

            <Link href="/contact/">
              Contact Us
            </Link>

            <Link href="/privacy-policy/">
              Privacy Policy
            </Link>

            <Link href="/terms-and-conditions/">
              Terms of Service
            </Link>

            <Link href="/disclaimer/">
              Disclaimer
            </Link>

          </nav>
        </div>

        {/* ================================================
            NEWSLETTER
        ================================================= */}

        <div className="cx-footer-newsletter">

          <span className="cx-footer-newsletter-label">
            STAY AHEAD
          </span>

          <h3>
            Join Our Newsletter
          </h3>

          <p>
            Get important crypto news and market
            insights delivered directly to your inbox.
          </p>

          <form
            className="cx-footer-form"
            onSubmit={handleNewsletterSubmit}
          >

            <input
              type="email"
              placeholder="Enter your email address"
              aria-label="Email address"
              required
            />

            <button
              type="submit"
              aria-label="Subscribe to newsletter"
            >
              <ArrowRight
                size={20}
                strokeWidth={2}
              />
            </button>

          </form>

          <div className="cx-footer-topics">

            <span>
              <i />
              News
            </span>

            <span>
              <i />
              Analysis
            </span>

            <span>
              <i />
              Markets
            </span>

          </div>

        </div>

      </div>

      {/* ================================================
          BOTTOM BAR
      ================================================= */}

      <div className="cx-footer-bottom">

        <div className="cx-footer-bottom-inner">

          <p>
            © {currentYear} CoinlytX. All rights reserved.
          </p>

          <div className="cx-footer-mission">
            <span>Inform</span>
            <i />
            <span>Educate</span>
            <i />
            <span>Empower</span>
          </div>

          <button
            type="button"
            className="cx-footer-top"
            onClick={scrollToTop}
            aria-label="Back to top"
          >
            <span>
              Back to Top
            </span>

            <i>
              <ArrowUp
                size={18}
                strokeWidth={2}
              />
            </i>
          </button>

        </div>

      </div>

    </footer>
  );
}
"use client";

import {
  Activity,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import CoinHologram, {
  type HologramCoin,
} from "./CoinHologram";

/* =========================================================
   TYPES
========================================================= */

type MarketCoin = HologramCoin & {
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
};

type CryptoResponse = {
  success: boolean;
  updatedAt?: string;
  coins: MarketCoin[];
};

/* =========================================================
   PRICE FORMATTER
========================================================= */

function formatPrice(value: number | null) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (value >= 1000) {
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }

  if (value >= 0.01) {
    return `$${value.toFixed(4)}`;
  }

  return `$${value.toFixed(6)}`;
}

/* =========================================================
   LOADING SKELETON
========================================================= */

function MarketSkeleton() {
  return (
    <div className="compact-market-track">
      <div className="compact-market-row">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="compact-market-card market-skeleton"
          />
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function LiveCryptoMarket() {
  const [coins, setCoins] = useState<MarketCoin[]>([]);

  const [selectedCoin, setSelectedCoin] =
    useState<MarketCoin | null>(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState(false);

  const rowRef = useRef<HTMLDivElement>(null);

  /* =======================================================
     LOAD LIVE MARKET
  ======================================================= */

  const loadMarket = useCallback(
    async (manual = false) => {
      try {
        if (manual) {
          setRefreshing(true);
        }

        const response = await fetch(
          `/api/crypto?t=${Date.now()}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Market API failed: ${response.status}`
          );
        }

        const data =
          (await response.json()) as CryptoResponse;

        if (!data.success) {
          throw new Error(
            "Crypto API returned success false."
          );
        }

        setCoins(data.coins ?? []);
        setError(false);
      } catch (err) {
        console.error(
          "Crypto market error:",
          err
        );

        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  /* =======================================================
     INITIAL LOAD + AUTO REFRESH
  ======================================================= */

  useEffect(() => {
    loadMarket();

    const interval = window.setInterval(() => {
      loadMarket();
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadMarket]);

  /* =======================================================
     CAROUSEL FUNCTION
  ======================================================= */

  const scrollMarket = useCallback(
    (direction: "left" | "right") => {
      const row = rowRef.current;

      if (!row) return;

      const amount =
        Math.min(row.clientWidth * 0.75, 620);

      row.scrollBy({
        left:
          direction === "right"
            ? amount
            : -amount,

        behavior: "smooth",
      });
    },
    []
  );

  /* =======================================================
     KEYBOARD LEFT / RIGHT
  ======================================================= */

  useEffect(() => {
    function handleKeyboard(
      event: KeyboardEvent
    ) {
      /*
       * Do not move carousel while
       * fullscreen hologram is open.
       */
      if (selectedCoin) return;

      /*
       * Do not interfere while typing
       * into an input/search field.
       */
      const target =
        event.target as HTMLElement | null;

      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        scrollMarket("left");
      }

      if (event.key === "ArrowRight") {
        scrollMarket("right");
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyboard
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyboard
      );
    };
  }, [selectedCoin, scrollMarket]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <>
      <section className="compact-market">

        {/* =================================================
            BACKGROUND WEB3 DECORATION
        ================================================== */}

        <div
          className="market-web3-decoration"
          aria-hidden="true"
        >
          <span className="market-web3-circle circle-one" />
          <span className="market-web3-circle circle-two" />
          <span className="market-web3-line line-one" />
          <span className="market-web3-line line-two" />
        </div>

        {/* =================================================
            HEADER
        ================================================== */}

        <div className="compact-market-header">

          <div className="compact-market-title">

            <div className="compact-market-icon">

              <Activity size={19} />

              <span className="market-icon-orbit" />

            </div>

            <div>

              <span className="compact-market-live">

                <i />

                LIVE CRYPTO MARKET

              </span>

              <h2>
                Crypto Market{" "}
                <em>Pulse</em>
              </h2>

            </div>

          </div>

          {/* Only refresh icon on right */}

          <div className="compact-market-tools">

            <button
              type="button"
              className={
                refreshing
                  ? "compact-refresh is-refreshing"
                  : "compact-refresh"
              }
              onClick={() =>
                loadMarket(true)
              }
              aria-label="Refresh crypto market"
              title="Refresh crypto market"
            >
              <RefreshCw size={17} />
            </button>

          </div>

        </div>

        {/* =================================================
            LOADING
        ================================================== */}

        {loading && <MarketSkeleton />}

        {/* =================================================
            ERROR
        ================================================== */}

        {!loading && error && (
          <div className="compact-market-error">

            <span>
              Live market data is temporarily unavailable.
            </span>

            <button
              type="button"
              onClick={() =>
                loadMarket(true)
              }
            >
              Try again
            </button>

          </div>
        )}

        {/* =================================================
            LIVE MARKET CAROUSEL
        ================================================== */}

        {!loading && !error && (
          <div className="compact-market-track">

            {/* =============================================
                LEFT SIDE ARROW
            ============================================== */}

            <button
              type="button"
              className="compact-nav compact-nav-left"
              onClick={() =>
                scrollMarket("left")
              }
              aria-label="Previous cryptocurrencies"
              title="Previous cryptocurrencies"
            >
              <ChevronLeft size={22} />
            </button>

            {/* =============================================
                COIN ROW
            ============================================== */}

            <div
              ref={rowRef}
              className="compact-market-row"
            >

              {coins.map((coin) => {
                const change =
                  coin.price_change_percentage_24h ??
                  coin.price_change_percentage_24h_in_currency ??
                  0;

                const positive =
                  change >= 0;

                return (
                  <button
                    key={coin.id}
                    type="button"
                    className="compact-market-card"
                    onClick={() =>
                      setSelectedCoin(coin)
                    }
                    aria-label={`Open ${coin.name} live market intelligence`}
                  >

                    {/* =====================================
                        CARD LIGHT / DEPTH
                    ====================================== */}

                    <span
                      className="market-card-light"
                      aria-hidden="true"
                    />

                    <span
                      className="market-card-edge"
                      aria-hidden="true"
                    />

                    <span
                      className="compact-web3-orbit"
                      aria-hidden="true"
                    />

                    {/* =====================================
                        3D COIN
                    ====================================== */}

                    <div className="market-coin-scene">

                      {/* horizontal orbital ring */}

                      <span
                        className="market-coin-orbit orbit-one"
                        aria-hidden="true"
                      />

                      {/* vertical orbital ring */}

                      <span
                        className="market-coin-orbit orbit-two"
                        aria-hidden="true"
                      />

                      {/* physical coin */}

                      <div className="market-coin-3d">

                        {/* coin thickness */}

                        <span
                          className="market-coin-depth"
                          aria-hidden="true"
                        />

                        {/* metallic edge */}

                        <span
                          className="market-coin-rim"
                          aria-hidden="true"
                        />

                        {/* real CoinGecko logo */}

                        <span className="market-coin-face">

                          <img
                            src={coin.image}
                            alt={`${coin.name} logo`}
                            loading="lazy"
                            draggable={false}
                          />

                        </span>

                        {/* glass reflection */}

                        <span
                          className="market-coin-shine"
                          aria-hidden="true"
                        />

                      </div>

                    </div>

                    {/* =====================================
                        COIN IDENTITY
                    ====================================== */}

                    <div className="compact-coin-info">

                      <div className="compact-symbol">

                        <strong>
                          {coin.symbol.toUpperCase()}
                        </strong>

                        <span>
                          #{coin.market_cap_rank ?? "—"}
                        </span>

                      </div>

                      <small>
                        {coin.name}
                      </small>

                    </div>

                    {/* =====================================
                        PRICE
                    ====================================== */}

                    <div className="compact-price">

                      {formatPrice(
                        coin.current_price
                      )}

                    </div>

                    {/* =====================================
                        24H MOVEMENT
                    ====================================== */}

                    <div
                      className={
                        positive
                          ? "compact-change positive"
                          : "compact-change negative"
                      }
                    >

                      <span className="compact-change-arrow">
                        {positive ? "↗" : "↘"}
                      </span>

                      <strong>
                        {positive ? "+" : ""}
                        {change.toFixed(2)}%
                      </strong>

                      <small>
                        24H
                      </small>

                    </div>

                    {/* =====================================
                        WEB3 DATA RAIL
                    ====================================== */}

                    <div
                      className="market-card-data"
                      aria-hidden="true"
                    >

                      <i />

                      <span />

                      <b />

                      <span />

                      <i />

                    </div>

                  </button>
                );
              })}

            </div>

            {/* =============================================
                RIGHT SIDE ARROW
            ============================================== */}

            <button
              type="button"
              className="compact-nav compact-nav-right"
              onClick={() =>
                scrollMarket("right")
              }
              aria-label="Next cryptocurrencies"
              title="Next cryptocurrencies"
            >
              <ChevronRight size={22} />
            </button>

          </div>
        )}

        {/* =================================================
            SMALL FOOTER
        ================================================== */}

        {!loading && !error && (
          <div className="compact-market-foot">

            <span />

            LIVE MARKET INTELLIGENCE

            <span />

          </div>
        )}

      </section>

      {/* ===================================================
          FULLSCREEN COIN HOLOGRAM
      ==================================================== */}

      <CoinHologram
        coin={selectedCoin}
        onClose={() =>
          setSelectedCoin(null)
        }
      />

    </>
  );
}
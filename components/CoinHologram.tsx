"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

export type HologramCoin = {
  id: string;
  symbol: string;
  name: string;
  image: string;

  current_price: number | null;

  market_cap: number | null;
  market_cap_rank: number | null;

  total_volume: number | null;

  high_24h: number | null;
  low_24h: number | null;

  price_change_percentage_24h: number | null;

  circulating_supply: number | null;
  total_supply: number | null;
  max_supply: number | null;

  ath: number | null;
  atl: number | null;

  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
};

type CoinHologramProps = {
  coin: HologramCoin | null;
  onClose: () => void;
};

/* =========================================================
   FORMATTERS
========================================================= */

function formatPrice(value: number | null) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (value >= 1000) {
    return `$${value.toLocaleString("en-US", {
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

function formatCompact(value: number | null) {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(
  value: number | null | undefined
) {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

/* =========================================================
   STAT
========================================================= */

function HoloStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="hx-stat">
      <div className="hx-stat-corner" />

      <span>{label}</span>

      <strong>{value}</strong>

      <div className="hx-stat-line" />
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function CoinHologram({
  coin,
  onClose,
}: CoinHologramProps) {
  const [mounted, setMounted] = useState(false);

  /*
   * Portal must only render after browser mounts.
   * This avoids document/body problems with Next.js SSR.
   */
  useEffect(() => {
    setMounted(true);

    return () => {
      setMounted(false);
    };
  }, []);

  /*
   * ESC can also close the hologram.
   * We DO NOT disable body scrolling.
   */
  useEffect(() => {
    if (!coin) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [coin, onClose]);

  if (!mounted || !coin) {
    return null;
  }

  const change24 =
    coin.price_change_percentage_24h ??
    coin.price_change_percentage_24h_in_currency ??
    0;

  const positive24 = change24 >= 0;

  const change1h =
    coin.price_change_percentage_1h_in_currency;

  const change7d =
    coin.price_change_percentage_7d_in_currency;

  /* =======================================================
     PORTAL
  ======================================================= */

  return createPortal(
    <div
      className="hx-overlay"
      onClick={onClose}
      role="presentation"
    >
      {/* ===============================================
          BACKGROUND
      ================================================ */}

      <div className="hx-grid" />

      <div className="hx-scan" />

      <div className="hx-noise" />

      {/* futuristic HUD corners */}

      <div className="hx-corner hx-corner-tl" />

      <div className="hx-corner hx-corner-tr" />

      <div className="hx-corner hx-corner-bl" />

      <div className="hx-corner hx-corner-br" />

      {/* ===============================================
          TOP MESSAGE
      ================================================ */}

      <div className="hx-exit-hint">
        CLICK ANYWHERE TO CLOSE
      </div>

      {/* ===============================================
          MAIN HOLOGRAPHIC TERMINAL
      ================================================ */}

      <div className="hx-terminal">

        {/* =============================================
            COIN IDENTITY
        ============================================== */}

        <div className="hx-coin">

          <div className="hx-logo-wrap">

            <div className="hx-logo-ring" />

            <img
              src={coin.image}
              alt={`${coin.name} logo`}
            />

          </div>

          <div className="hx-coin-info">

            <span>
              MARKET #{coin.market_cap_rank ?? "—"}
              {" // "}
              {coin.symbol.toUpperCase()} / USD
            </span>

            <h2>{coin.name}</h2>

          </div>

        </div>

        {/* =============================================
            LIVE PRICE
        ============================================== */}

        <div className="hx-price">

          <span className="hx-live">

            <i />

            LIVE MARKET

          </span>

          <strong>
            {formatPrice(coin.current_price)}
          </strong>

          <div
            className={
              positive24
                ? "hx-change hx-up"
                : "hx-change hx-down"
            }
          >

            {positive24 ? "▲" : "▼"}

            {" "}

            {formatPercent(change24)}

            <span>24H</span>

          </div>

        </div>

        {/* =============================================
            LEFT MARKET DATA
        ============================================== */}

        <div className="hx-stats hx-stats-left">

          <HoloStat
            label="24H HIGH"
            value={formatPrice(
              coin.high_24h
            )}
          />

          <HoloStat
            label="MARKET CAP"
            value={
              coin.market_cap === null
                ? "—"
                : `$${formatCompact(
                    coin.market_cap
                  )}`
            }
          />

          <HoloStat
            label="ALL-TIME HIGH"
            value={formatPrice(
              coin.ath
            )}
          />

          <HoloStat
            label="CIRCULATING SUPPLY"
            value={
              coin.circulating_supply === null
                ? "—"
                : `${formatCompact(
                    coin.circulating_supply
                  )} ${coin.symbol.toUpperCase()}`
            }
          />

        </div>

        {/* =============================================
            RIGHT MARKET DATA
        ============================================== */}

        <div className="hx-stats hx-stats-right">

          <HoloStat
            label="24H LOW"
            value={formatPrice(
              coin.low_24h
            )}
          />

          <HoloStat
            label="24H VOLUME"
            value={
              coin.total_volume === null
                ? "—"
                : `$${formatCompact(
                    coin.total_volume
                  )}`
            }
          />

          <HoloStat
            label="ALL-TIME LOW"
            value={formatPrice(
              coin.atl
            )}
          />

          <HoloStat
            label="TOTAL SUPPLY"
            value={
              coin.total_supply === null
                ? "—"
                : `${formatCompact(
                    coin.total_supply
                  )} ${coin.symbol.toUpperCase()}`
            }
          />

        </div>

        {/* =============================================
            HOLOGRAPHIC CHART
        ============================================== */}

        <div className="hx-chart">

          <div className="hx-chart-grid" />

          <div className="hx-chart-top">

            <span>
              LIVE PROJECTION
            </span>

            <i>
              {coin.symbol.toUpperCase()}
              /USD
            </i>

          </div>

          {/* decorative candles for now */}

          <div className="hx-candles">

            <i className="hx-candle green h1" />

            <i className="hx-candle green h2" />

            <i className="hx-candle red h3" />

            <i className="hx-candle green h4" />

            <i className="hx-candle green h5" />

            <i className="hx-candle red h6" />

            <i className="hx-candle green h7" />

            <i className="hx-candle green h8" />

            <i className="hx-candle red h9" />

            <i className="hx-candle green h10" />

            <i className="hx-candle green h11" />

            <i className="hx-candle red h12" />

            <i className="hx-candle green h13" />

            <i className="hx-candle green h14" />

          </div>

          <div className="hx-chart-glow" />

        </div>

        {/* =============================================
            PERFORMANCE PERIODS
        ============================================== */}

        <div className="hx-periods">

          <div>

            <span>
              1 HOUR
            </span>

            <strong
              className={
                (change1h ?? 0) >= 0
                  ? "hx-up"
                  : "hx-down"
              }
            >
              {formatPercent(change1h)}
            </strong>

          </div>

          <div>

            <span>
              24 HOURS
            </span>

            <strong
              className={
                positive24
                  ? "hx-up"
                  : "hx-down"
              }
            >
              {formatPercent(change24)}
            </strong>

          </div>

          <div>

            <span>
              7 DAYS
            </span>

            <strong
              className={
                (change7d ?? 0) >= 0
                  ? "hx-up"
                  : "hx-down"
              }
            >
              {formatPercent(change7d)}
            </strong>

          </div>

        </div>

        {/* =============================================
            PROJECTION LIGHT BEAM
        ============================================== */}

        <div className="hx-beam" />

        {/* =============================================
            HOLOGRAPHIC PROJECTOR BASE
        ============================================== */}

        <div className="hx-base">

          <div className="hx-base-ring ring1" />

          <div className="hx-base-ring ring2" />

          <div className="hx-base-ring ring3" />

          <div className="hx-emitter" />

        </div>

        {/* =============================================
            SYSTEM LABEL
        ============================================== */}

        <div className="hx-system">

          <span />

          COINLYTX MARKET INTELLIGENCE

          <span />

        </div>

      </div>

    </div>,

    document.body
  );
}
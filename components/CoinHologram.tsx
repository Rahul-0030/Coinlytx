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

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

/* =========================================================
   STAT CARD
========================================================= */

function HoloStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="cxh-stat">
      <div className="cxh-stat-corner" />

      <span>{label}</span>

      <strong>{value}</strong>

      <div className="cxh-stat-scan" />
    </div>
  );
}

/* =========================================================
   DECORATIVE HOLOGRAPHIC CANDLE CHART
========================================================= */

const candles = [
  { height: 37, wick: 57, up: true },
  { height: 58, wick: 78, up: true },
  { height: 42, wick: 64, up: false },
  { height: 67, wick: 88, up: true },
  { height: 52, wick: 72, up: true },
  { height: 43, wick: 67, up: false },
  { height: 79, wick: 99, up: true },
  { height: 70, wick: 91, up: true },
  { height: 56, wick: 78, up: false },
  { height: 88, wick: 108, up: true },
  { height: 98, wick: 118, up: true },
  { height: 73, wick: 95, up: false },
  { height: 94, wick: 115, up: true },
  { height: 111, wick: 132, up: true },
];

function HolographicChart() {
  return (
    <div className="cxh-chart">
      <div className="cxh-chart-grid" />

      <div className="cxh-chart-horizon" />

      <div className="cxh-chart-orbit cxh-chart-orbit-one" />
      <div className="cxh-chart-orbit cxh-chart-orbit-two" />

      <div className="cxh-candles">
        {candles.map((candle, index) => (
          <div
            className={`cxh-candle ${
              candle.up ? "cxh-candle-up" : "cxh-candle-down"
            }`}
            key={index}
          >
            <i
              className="cxh-candle-wick"
              style={{
                height: `${candle.wick}px`,
              }}
            />

            <i
              className="cxh-candle-body"
              style={{
                height: `${candle.height}px`,
              }}
            />
          </div>
        ))}
      </div>

      <div className="cxh-chart-floor" />
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

  useEffect(() => {
    setMounted(true);

    return () => {
      setMounted(false);
    };
  }, []);

  useEffect(() => {
    if (!coin) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
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

  const change1h = coin.price_change_percentage_1h_in_currency;

  const change7d = coin.price_change_percentage_7d_in_currency;

  const symbol = coin.symbol.toUpperCase();

  return createPortal(
    <div
      className="cxh-overlay"
      onClick={onClose}
      role="presentation"
    >
      {/* =====================================================
          BACKGROUND
      ====================================================== */}

      <div className="cxh-bg-grid" />

      <div className="cxh-bg-glow cxh-bg-glow-one" />
      <div className="cxh-bg-glow cxh-bg-glow-two" />

      <div className="cxh-world">
        <div className="cxh-world-ring cxh-world-ring-one" />
        <div className="cxh-world-ring cxh-world-ring-two" />
        <div className="cxh-world-ring cxh-world-ring-three" />
      </div>

      <div className="cxh-scanline" />

      {/* =====================================================
          HUD CORNERS
      ====================================================== */}

      <div className="cxh-corner cxh-corner-tl" />
      <div className="cxh-corner cxh-corner-tr" />
      <div className="cxh-corner cxh-corner-bl" />
      <div className="cxh-corner cxh-corner-br" />

      {/* =====================================================
          CLOSE MESSAGE
      ====================================================== */}

      <div className="cxh-close-message">
        CLICK ANYWHERE TO CLOSE
      </div>

      {/* =====================================================
          TERMINAL
      ====================================================== */}

      <div
        className="cxh-terminal"
        onClick={(event) => {
          /*
           * We deliberately do not stop propagation.
           * The user requested click-anywhere-to-close.
           */
          void event;
        }}
      >
        {/* ===================================================
            HEADER
        ==================================================== */}

        <div className="cxh-header">
          <div className="cxh-coin-logo">
            <div className="cxh-logo-orbit cxh-logo-orbit-one" />
            <div className="cxh-logo-orbit cxh-logo-orbit-two" />

            <img
              src={coin.image}
              alt={`${coin.name} logo`}
              draggable={false}
            />

            <i />
          </div>

          <div className="cxh-identity">
            <span>
              MARKET #{coin.market_cap_rank ?? "—"} // {symbol} / USD
            </span>

            <h2>{coin.name}</h2>
          </div>
        </div>

        {/* ===================================================
            PRICE
        ==================================================== */}

        <div className="cxh-price-block">
          <div className="cxh-live">
            <i />
            LIVE MARKET
          </div>

          <strong className="cxh-current-price">
            {formatPrice(coin.current_price)}
          </strong>

          <div
            className={`cxh-price-change ${
              positive24 ? "cxh-positive" : "cxh-negative"
            }`}
          >
            <b>{positive24 ? "▲" : "▼"}</b>

            {formatPercent(change24)}

            <span>24H</span>
          </div>
        </div>

        {/* ===================================================
            LEFT STATS
        ==================================================== */}

        <div className="cxh-stats cxh-stats-left">
          <HoloStat
            label="24H HIGH"
            value={formatPrice(coin.high_24h)}
          />

          <HoloStat
            label="MARKET CAP"
            value={
              coin.market_cap === null
                ? "—"
                : `$${formatCompact(coin.market_cap)}`
            }
          />

          <HoloStat
            label="ALL-TIME HIGH"
            value={formatPrice(coin.ath)}
          />

          <HoloStat
            label="CIRCULATING SUPPLY"
            value={
              coin.circulating_supply === null
                ? "—"
                : `${formatCompact(
                    coin.circulating_supply
                  )} ${symbol}`
            }
          />
        </div>

        {/* ===================================================
            RIGHT STATS
        ==================================================== */}

        <div className="cxh-stats cxh-stats-right">
          <HoloStat
            label="24H LOW"
            value={formatPrice(coin.low_24h)}
          />

          <HoloStat
            label="24H VOLUME"
            value={
              coin.total_volume === null
                ? "—"
                : `$${formatCompact(coin.total_volume)}`
            }
          />

          <HoloStat
            label="ALL-TIME LOW"
            value={formatPrice(coin.atl)}
          />

          <HoloStat
            label="TOTAL SUPPLY"
            value={
              coin.total_supply === null
                ? "—"
                : `${formatCompact(coin.total_supply)} ${symbol}`
            }
          />
        </div>

        {/* ===================================================
            CENTER PROJECTION
        ==================================================== */}

        <div className="cxh-projection">
          <div className="cxh-projection-labels">
            <span>LIVE PROJECTION</span>

            <i>{symbol}/USD</i>
          </div>

          <div className="cxh-light-beam" />

          <HolographicChart />
        </div>

        {/* ===================================================
            PERFORMANCE
        ==================================================== */}

        <div className="cxh-periods">
          <div>
            <span>1 HOUR</span>

            <strong
              className={
                (change1h ?? 0) >= 0
                  ? "cxh-positive"
                  : "cxh-negative"
              }
            >
              {formatPercent(change1h)}
            </strong>
          </div>

          <div className="cxh-period-active">
            <span>24 HOURS</span>

            <strong
              className={
                positive24 ? "cxh-positive" : "cxh-negative"
              }
            >
              {formatPercent(change24)}
            </strong>
          </div>

          <div>
            <span>7 DAYS</span>

            <strong
              className={
                (change7d ?? 0) >= 0
                  ? "cxh-positive"
                  : "cxh-negative"
              }
            >
              {formatPercent(change7d)}
            </strong>
          </div>
        </div>

        {/* ===================================================
            SYSTEM NAME
        ==================================================== */}

        <div className="cxh-system">
          <span />

          COINLYTX MARKET INTELLIGENCE

          <span />
        </div>
      </div>
    </div>,

    document.body
  );
}
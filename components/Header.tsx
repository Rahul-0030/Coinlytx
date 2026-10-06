"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type LanguageCode =
  | "EN"
  | "DE"
  | "FR"
  | "IT"
  | "AR"
  | "RU"
  | "ES";

type Language = {
  code: LanguageCode;
  name: string;
  flag: string;
};

const languages: Language[] = [
  {
    code: "EN",
    name: "English",
    flag: "🇬🇧",
  },
  {
    code: "DE",
    name: "Deutsch",
    flag: "🇩🇪",
  },
  {
    code: "FR",
    name: "Français",
    flag: "🇫🇷",
  },
  {
    code: "IT",
    name: "Italiano",
    flag: "🇮🇹",
  },
  {
    code: "AR",
    name: "العربية",
    flag: "🇸🇦",
  },
  {
    code: "RU",
    name: "Русский",
    flag: "🇷🇺",
  },
  {
    code: "ES",
    name: "Español",
    flag: "🇪🇸",
  },
];

const menuText = {
  EN: {
    news: "News",
    markets: "Markets",
    press: "Press Release",
    learn: "Learn",
    about: "About Us",
    contact: "Contact",
    more: "More",
    reviews: "Reviews",
    sponsored: "Sponsored",

    cryptoNews: "Crypto News",
    bitcoin: "Bitcoin",
    ethereum: "Ethereum",
    altcoins: "Altcoins",
    global: "Global Trending",

    prices: "Crypto Prices",
    analysis: "Price Analysis",
    exchanges: "Exchanges",

    search: "Search CoinlytX",
    placeholder: "Search Bitcoin, Ethereum, Web3...",
    trending: "Trending",
  },

  DE: {
    news: "Nachrichten",
    markets: "Märkte",
    press: "Presse",
    learn: "Lernen",
    about: "Über uns",
    contact: "Kontakt",
    more: "Mehr",
    reviews: "Bewertungen",
    sponsored: "Gesponsert",

    cryptoNews: "Krypto-News",
    bitcoin: "Bitcoin",
    ethereum: "Ethereum",
    altcoins: "Altcoins",
    global: "Globale Trends",

    prices: "Krypto-Preise",
    analysis: "Preisanalyse",
    exchanges: "Börsen",

    search: "CoinlytX durchsuchen",
    placeholder: "Bitcoin, Ethereum, Web3 suchen...",
    trending: "Trends",
  },

  FR: {
    news: "Actualités",
    markets: "Marchés",
    press: "Communiqués",
    learn: "Apprendre",
    about: "À propos",
    contact: "Contact",
    more: "Plus",
    reviews: "Avis",
    sponsored: "Sponsorisé",

    cryptoNews: "Actualités Crypto",
    bitcoin: "Bitcoin",
    ethereum: "Ethereum",
    altcoins: "Altcoins",
    global: "Tendances mondiales",

    prices: "Prix Crypto",
    analysis: "Analyse des prix",
    exchanges: "Exchanges",

    search: "Rechercher sur CoinlytX",
    placeholder: "Rechercher Bitcoin, Ethereum, Web3...",
    trending: "Tendances",
  },

  IT: {
    news: "Notizie",
    markets: "Mercati",
    press: "Comunicati",
    learn: "Impara",
    about: "Chi siamo",
    contact: "Contatti",
    more: "Altro",
    reviews: "Recensioni",
    sponsored: "Sponsorizzato",

    cryptoNews: "Notizie Crypto",
    bitcoin: "Bitcoin",
    ethereum: "Ethereum",
    altcoins: "Altcoin",
    global: "Tendenze globali",

    prices: "Prezzi Crypto",
    analysis: "Analisi prezzi",
    exchanges: "Exchange",

    search: "Cerca su CoinlytX",
    placeholder: "Cerca Bitcoin, Ethereum, Web3...",
    trending: "Tendenze",
  },

  AR: {
    news: "الأخبار",
    markets: "الأسواق",
    press: "البيانات الصحفية",
    learn: "تعلم",
    about: "من نحن",
    contact: "اتصل بنا",
    more: "المزيد",
    reviews: "المراجعات",
    sponsored: "برعاية",

    cryptoNews: "أخبار العملات",
    bitcoin: "بيتكوين",
    ethereum: "إيثريوم",
    altcoins: "العملات البديلة",
    global: "الاتجاهات العالمية",

    prices: "أسعار العملات",
    analysis: "تحليل الأسعار",
    exchanges: "المنصات",

    search: "البحث في CoinlytX",
    placeholder: "ابحث عن بيتكوين وإيثريوم وWeb3...",
    trending: "الرائج",
  },

  RU: {
    news: "Новости",
    markets: "Рынки",
    press: "Пресс-релизы",
    learn: "Обучение",
    about: "О нас",
    contact: "Контакты",
    more: "Ещё",
    reviews: "Обзоры",
    sponsored: "Спонсорское",

    cryptoNews: "Крипто-новости",
    bitcoin: "Bitcoin",
    ethereum: "Ethereum",
    altcoins: "Альткоины",
    global: "Мировые тренды",

    prices: "Цены криптовалют",
    analysis: "Анализ цен",
    exchanges: "Биржи",

    search: "Поиск CoinlytX",
    placeholder: "Поиск Bitcoin, Ethereum, Web3...",
    trending: "В тренде",
  },

  ES: {
    news: "Noticias",
    markets: "Mercados",
    press: "Comunicados",
    learn: "Aprender",
    about: "Nosotros",
    contact: "Contacto",
    more: "Más",
    reviews: "Reseñas",
    sponsored: "Patrocinado",

    cryptoNews: "Noticias Crypto",
    bitcoin: "Bitcoin",
    ethereum: "Ethereum",
    altcoins: "Altcoins",
    global: "Tendencias globales",

    prices: "Precios Crypto",
    analysis: "Análisis de precios",
    exchanges: "Exchanges",

    search: "Buscar en CoinlytX",
    placeholder: "Buscar Bitcoin, Ethereum, Web3...",
    trending: "Tendencias",
  },
};

export default function Header() {
  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [mobileNewsOpen, setMobileNewsOpen] =
    useState(false);

  const [mobileMarketsOpen, setMobileMarketsOpen] =
    useState(false);

  const [searchOpen, setSearchOpen] =
    useState(false);

  const [languageOpen, setLanguageOpen] =
    useState(false);

  const [language, setLanguage] =
    useState<LanguageCode>("EN");

  const [darkMode, setDarkMode] =
    useState(false);

  const languageRef =
    useRef<HTMLDivElement>(null);

  const text = menuText[language];

  const selectedLanguage =
    languages.find(
      (item) => item.code === language
    ) ?? languages[0];

  useEffect(() => {
    const savedLanguage =
      localStorage.getItem(
        "coinlytx-language"
      ) as LanguageCode | null;

    if (
      savedLanguage &&
      languages.some(
        (item) =>
          item.code === savedLanguage
      )
    ) {
      setLanguage(savedLanguage);

      document.documentElement.lang =
        savedLanguage.toLowerCase();

      document.documentElement.dir =
        savedLanguage === "AR"
          ? "rtl"
          : "ltr";
    }

    const savedTheme =
      localStorage.getItem(
        "coinlytx-theme"
      );

    if (savedTheme === "dark") {
      setDarkMode(true);

      document.documentElement.classList.add(
        "dark"
      );
    }
  }, []);

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        languageRef.current &&
        !languageRef.current.contains(
          event.target as Node
        )
      ) {
        setLanguageOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  function changeLanguage(
    code: LanguageCode
  ) {
    setLanguage(code);

    localStorage.setItem(
      "coinlytx-language",
      code
    );

    setLanguageOpen(false);

    document.documentElement.lang =
      code.toLowerCase();

    document.documentElement.dir =
      code === "AR"
        ? "rtl"
        : "ltr";
  }

  function toggleTheme() {
    const nextTheme = !darkMode;

    setDarkMode(nextTheme);

    if (nextTheme) {
      document.documentElement.classList.add(
        "dark"
      );

      localStorage.setItem(
        "coinlytx-theme",
        "dark"
      );
    } else {
      document.documentElement.classList.remove(
        "dark"
      );

      localStorage.setItem(
        "coinlytx-theme",
        "light"
      );
    }
  }

  function closeMobileMenu() {
    setMobileOpen(false);
    setMobileNewsOpen(false);
    setMobileMarketsOpen(false);
  }

  return (
    <>
      <header className="main-header">
        <div className="header-inner">

          {/* =========================
              LOGO
          ========================== */}

          <Link
            href="/"
            className="brand"
            aria-label="CoinlytX Home"
          >
            <div className="logo-3d">
              <div className="logo-glow" />

              <Image
                src="/image/coinlytx-logo.png"
                alt="CoinlytX"
                width={260}
                height={82}
                priority
                className="brand-logo"
              />

              <div className="logo-shine" />
            </div>
          </Link>

          {/* =========================
              DESKTOP NAVIGATION
          ========================== */}

          <nav
            className="main-navigation"
            aria-label="Main navigation"
          >

            {/* NEWS */}

            <div className="nav-dropdown">
              <button
                type="button"
                className="nav-link"
              >
                {text.news}

                <ChevronDown size={14} />
              </button>

              <div className="dropdown-panel simple-dropdown">

                <Link href="/crypto-news">
                  {text.cryptoNews}
                </Link>

                <Link href="/bitcoin">
                  {text.bitcoin}
                </Link>

                <Link href="/ethereum">
                  {text.ethereum}
                </Link>

                <Link href="/altcoins">
                  {text.altcoins}
                </Link>

                <Link href="/global-trending">
                  {text.global}
                </Link>

              </div>
            </div>

            {/* MARKETS */}

            <div className="nav-dropdown">
              <button
                type="button"
                className="nav-link"
              >
                {text.markets}

                <ChevronDown size={14} />
              </button>

              <div className="dropdown-panel simple-dropdown">

                <Link href="/crypto-prices">
                  {text.prices}
                </Link>

                <Link href="/price-analysis">
                  {text.analysis}
                </Link>

                <Link href="/exchanges">
                  {text.exchanges}
                </Link>

              </div>
            </div>

            {/* PRESS RELEASE */}

            <Link
              href="/press-release"
              className="nav-link"
            >
              {text.press}
            </Link>

            {/* LEARN */}

            <Link
              href="/learn"
              className="nav-link"
            >
              {text.learn}
            </Link>

            {/* ABOUT */}

            <Link
              href="/about"
              className="nav-link"
            >
              {text.about}
            </Link>

            {/* CONTACT */}

            <Link
              href="/contact"
              className="nav-link"
            >
              {text.contact}
            </Link>

            {/* MORE */}

            <div className="nav-dropdown">
              <button
                type="button"
                className="nav-link"
              >
                {text.more}

                <ChevronDown size={14} />
              </button>

              <div className="dropdown-panel simple-dropdown more-dropdown">

                <Link href="/reviews">
                  {text.reviews}
                </Link>

                <Link href="/sponsored">
                  {text.sponsored}
                </Link>

              </div>
            </div>

          </nav>

          {/* =========================
              RIGHT TOOLS
          ========================== */}

          <div className="header-tools">

            {/* SEARCH */}

            <button
              type="button"
              className="header-tool-button search-trigger"
              aria-label="Search"
              onClick={() =>
                setSearchOpen(true)
              }
            >
              <Search size={18} />
            </button>

            {/* LANGUAGE */}

            <div
              className="language-selector"
              ref={languageRef}
            >
              <button
                type="button"
                className="language-button"
                onClick={() =>
                  setLanguageOpen(
                    !languageOpen
                  )
                }
                aria-label="Select language"
                aria-expanded={languageOpen}
              >
                <span className="current-language-flag">
                  {selectedLanguage.flag}
                </span>

                <span className="current-language-code">
                  {selectedLanguage.code}
                </span>

                <ChevronDown
                  size={13}
                  className={
                    languageOpen
                      ? "language-arrow language-arrow-open"
                      : "language-arrow"
                  }
                />
              </button>

              {languageOpen && (
                <div className="language-menu">

                  <div className="language-menu-title">
                    Language
                  </div>

                  {languages.map(
                    (item) => (
                      <button
                        type="button"
                        key={item.code}
                        onClick={() =>
                          changeLanguage(
                            item.code
                          )
                        }
                        className={
                          language ===
                          item.code
                            ? "active-language"
                            : ""
                        }
                      >
                        <span className="language-flag">
                          {item.flag}
                        </span>

                        <strong>
                          {item.code}
                        </strong>

                        <span className="language-name">
                          {item.name}
                        </span>
                      </button>
                    )
                  )}

                </div>
              )}
            </div>

            {/* DARK / LIGHT */}

            <button
              type="button"
              className="header-tool-button theme-button"
              onClick={toggleTheme}
              aria-label={
                darkMode
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {darkMode ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>

            {/* THREE-LINE MOBILE/TABLET MENU */}

            <button
              type="button"
              className="header-tool-button mobile-toggle"
              onClick={() =>
                setMobileOpen(
                  !mobileOpen
                )
              }
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <X size={23} />
              ) : (
                <Menu size={24} />
              )}
            </button>

          </div>
        </div>
      </header>

      {/* =====================================================
          MOBILE + TABLET MENU
      ====================================================== */}

      {mobileOpen && (
        <div className="mobile-menu-overlay">

          <div className="mobile-navigation">

            <div className="mobile-menu-top">

              <span>
                COINLYTX
              </span>

              <strong>
                Explore
              </strong>

            </div>

            {/* NEWS */}

            <div className="mobile-menu-group">

              <button
                type="button"
                className="mobile-parent-link"
                onClick={() =>
                  setMobileNewsOpen(
                    !mobileNewsOpen
                  )
                }
              >
                <span>
                  {text.news}
                </span>

                <ChevronDown
                  size={18}
                  className={
                    mobileNewsOpen
                      ? "mobile-chevron-open"
                      : ""
                  }
                />
              </button>

              {mobileNewsOpen && (
                <div className="mobile-submenu">

                  <Link
                    href="/crypto-news"
                    onClick={closeMobileMenu}
                  >
                    {text.cryptoNews}
                  </Link>

                  <Link
                    href="/bitcoin"
                    onClick={closeMobileMenu}
                  >
                    {text.bitcoin}
                  </Link>

                  <Link
                    href="/ethereum"
                    onClick={closeMobileMenu}
                  >
                    {text.ethereum}
                  </Link>

                  <Link
                    href="/altcoins"
                    onClick={closeMobileMenu}
                  >
                    {text.altcoins}
                  </Link>

                  <Link
                    href="/global-trending"
                    onClick={closeMobileMenu}
                  >
                    {text.global}
                  </Link>

                </div>
              )}

            </div>

            {/* MARKETS */}

            <div className="mobile-menu-group">

              <button
                type="button"
                className="mobile-parent-link"
                onClick={() =>
                  setMobileMarketsOpen(
                    !mobileMarketsOpen
                  )
                }
              >
                <span>
                  {text.markets}
                </span>

                <ChevronDown
                  size={18}
                  className={
                    mobileMarketsOpen
                      ? "mobile-chevron-open"
                      : ""
                  }
                />
              </button>

              {mobileMarketsOpen && (
                <div className="mobile-submenu">

                  <Link
                    href="/crypto-prices"
                    onClick={closeMobileMenu}
                  >
                    {text.prices}
                  </Link>

                  <Link
                    href="/price-analysis"
                    onClick={closeMobileMenu}
                  >
                    {text.analysis}
                  </Link>

                  <Link
                    href="/exchanges"
                    onClick={closeMobileMenu}
                  >
                    {text.exchanges}
                  </Link>

                </div>
              )}

            </div>

            {/* NORMAL MOBILE LINKS */}

            <Link
              href="/press-release"
              className="mobile-main-link"
              onClick={closeMobileMenu}
            >
              {text.press}
            </Link>

            <Link
              href="/learn"
              className="mobile-main-link"
              onClick={closeMobileMenu}
            >
              {text.learn}
            </Link>

            <Link
              href="/about"
              className="mobile-main-link"
              onClick={closeMobileMenu}
            >
              {text.about}
            </Link>

            <Link
              href="/contact"
              className="mobile-main-link"
              onClick={closeMobileMenu}
            >
              {text.contact}
            </Link>

            <Link
              href="/reviews"
              className="mobile-main-link"
              onClick={closeMobileMenu}
            >
              {text.reviews}
            </Link>

            <Link
              href="/sponsored"
              className="mobile-main-link"
              onClick={closeMobileMenu}
            >
              {text.sponsored}
            </Link>

          </div>
        </div>
      )}

      {/* =====================================================
          SEARCH OVERLAY
      ====================================================== */}

      {searchOpen && (
        <div
          className="search-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSearchOpen(false);
            }
          }}
        >
          <div className="search-box">

            <div className="search-heading">

              <div>
                <span>
                  COINLYTX SEARCH
                </span>

                <h2>
                  {text.search}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSearchOpen(false)
                }
                aria-label="Close search"
              >
                <X size={22} />
              </button>

            </div>

            <form
              className="search-form"
              action="/search"
            >

              <Search size={21} />

              <input
                name="q"
                autoFocus
                placeholder={
                  text.placeholder
                }
              />

              <button type="submit">
                <Search size={18} />

                Search
              </button>

            </form>

            <div className="popular-searches">

              <span>
                {text.trending}:
              </span>

              <Link href="/search?q=Bitcoin">
                Bitcoin
              </Link>

              <Link href="/search?q=Ethereum">
                Ethereum
              </Link>

              <Link href="/search?q=Web3">
                Web3
              </Link>

              <Link href="/search?q=DeFi">
                DeFi
              </Link>

            </div>

          </div>
        </div>
      )}
    </>
  );
}
import type {
  Metadata,
  Viewport,
} from "next";

import "./globals.css";

import Header from "../components/Header";
import Footer from "../components/Footer";
import StickyVideoBanner from "../components/StickyVideoBanner";
import HeaderVideoBanner from "../components/HeaderVideoBanner";

export const metadata: Metadata = {
  title: {
    default: "CoinlytX | Crypto News, Markets & Web3",
    template: "%s | CoinlytX",
  },

  description:
    "CoinlytX delivers cryptocurrency news, Bitcoin and Ethereum updates, market insights, Web3 developments, blockchain education and industry analysis.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {/* TOP ADVERTISEMENT */}
        <HeaderVideoBanner />

        {/* LOGO + NAVIGATION */}
        <Header />

        {/* PAGE CONTENT */}
        <main>
          {children}
        </main>

        {/* WEBSITE FOOTER */}
        <Footer />

        {/* STICKY BOTTOM ADVERTISEMENT */}
        <StickyVideoBanner />
      </body>
    </html>
  );
}
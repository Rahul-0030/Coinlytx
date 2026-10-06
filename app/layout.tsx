import type {
  Metadata,
  Viewport,
} from "next";

import "./globals.css";

import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: {
    default:
      "CoinlytX | Crypto News, Markets & Web3",
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
        <Header />

        <main>
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}
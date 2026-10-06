import type { Metadata } from "next";
import "./globals.css";
import Header from "../components/Header";

export const metadata: Metadata = {
  title: {
    default: "CoinlytX | Crypto News, Markets & Web3",
    template: "%s | CoinlytX",
  },

  description:
    "CoinlytX delivers cryptocurrency news, Bitcoin and Ethereum updates, market insights, Web3 developments, blockchain education and industry analysis.",
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

        <main>{children}</main>
      </body>
    </html>
  );
}
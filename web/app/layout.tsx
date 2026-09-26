import type { Metadata } from "next";
import { Inter_Tight, Roboto_Mono } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";
import { Shell } from "@/components/Shell";
import { WalletProvider } from "@/lib/wallet";

// The reference's Aspekta is not freely served; Inter Tight at 400 is its named substitute.
const sans = Inter_Tight({ subsets: ["latin"], weight: ["400"], variable: "--font-inter-tight" });
const mono = Roboto_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-roboto-mono" });

export const metadata: Metadata = {
  title: "Everkeep",
  description: "Community infrastructure funds that pay for maintenance only when the evidence keeps the rules they ratified.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <WalletProvider>
          <Shell>{children}</Shell>
        </WalletProvider>
      </body>
    </html>
  );
}

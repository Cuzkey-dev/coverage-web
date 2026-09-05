import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "画像から重要度関数Φを設計し、二輪移動ロボットの被覆制御シミュレーションを実行・保存・比較できるツール";

export const metadata: Metadata = {
  title: "Coverage Web — 被覆制御シミュレータ",
  description,
  // リンクを共有したときに題と説明が出るようにする
  openGraph: {
    title: "Coverage Web — 被覆制御シミュレータ",
    description,
    type: "website",
    locale: "ja_JP",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}

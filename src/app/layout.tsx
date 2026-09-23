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
  "鳥の羽ばたき・風車の回転・顔の表情にロボット群が追従する3つの動くモデル。時間変化する重要度の数式解説と、静止画像の被覆制御シミュレーション。";

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

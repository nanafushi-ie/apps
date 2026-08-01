import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IE requirements｜家づくり要件定義ツール",
  description: "質問にタップで答えるだけで、家づくりの希望と優先順位を整理。設計士に渡せる要件定義書を作成します。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}

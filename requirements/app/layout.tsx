import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "家づくりカルテ｜迷わない家づくりは、希望の整理から",
  description: "家族の「必ず」と「できれば」を選ぶだけ。設計士にそのまま渡せる家づくりカルテを作成します。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}

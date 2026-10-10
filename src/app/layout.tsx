import type { ReactNode } from "react";
import "./globals.css";

// Le layout racine réel (html/body, langue, thème) est dans app/[locale]/layout.tsx.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}

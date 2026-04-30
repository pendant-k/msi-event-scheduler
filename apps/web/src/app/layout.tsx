import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "행사 관리",
  description: "Event reservation and check-in system"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <main className="page-shell py-8">{children}</main>
      </body>
    </html>
  );
}

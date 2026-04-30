import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scheduler MSI",
  description: "Event reservation and check-in system"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="navbar border-b border-base-300 bg-base-100">
          <div className="page-shell flex items-center justify-between">
            <Link href="/" className="text-lg font-semibold">
              Scheduler MSI
            </Link>
            <div className="flex gap-2">
              <Link href="/event/msi-2026" className="btn btn-ghost btn-sm">
                예약
              </Link>
              <Link href="/admin" className="btn btn-ghost btn-sm">
                관리자
              </Link>
            </div>
          </div>
        </div>
        <main className="page-shell py-6">{children}</main>
      </body>
    </html>
  );
}

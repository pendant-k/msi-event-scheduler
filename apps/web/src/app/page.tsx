import Link from "next/link";

export default function HomePage() {
  return (
    <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold">행사 타임슬롯 예약 시스템</h1>
        <p className="text-base-content/70">
          QR 또는 URL로 행사 페이지에 들어와 예약하고, 현장에서는 관리자 체크인 대시보드로 빠르게 확인합니다.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/event/msi-2026" className="btn btn-primary">
            샘플 행사 예약
          </Link>
          <Link href="/event/msi-2026/schedule" className="btn btn-outline">
            전체 시간표
          </Link>
        </div>
      </section>
      <section className="rounded border border-base-300 bg-base-100 p-4">
        <h2 className="font-semibold">로컬 프로토타입</h2>
        <p className="mt-2 text-sm text-base-content/70">
          먼저 <code>pnpm db:seed</code>로 샘플 데이터를 만든 뒤 사용합니다.
        </p>
      </section>
    </div>
  );
}

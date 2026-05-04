"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function AdminRefreshButton({ label = "새로고침" }: { label?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className="btn btn-outline btn-sm gap-2 border-[var(--app-blue)]/25 bg-[var(--app-blue)]/8 text-[var(--app-blue)] hover:border-[var(--app-blue)] hover:bg-[var(--app-blue)] hover:text-white"
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw aria-hidden="true" className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "확인 중" : label}
    </button>
  );
}

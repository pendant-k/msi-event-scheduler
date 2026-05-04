"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  Clock,
  ExternalLink,
  Home,
  LayoutDashboard,
  Menu,
  Plus,
  Rows3,
  ShieldCheck,
  X,
  type LucideIcon
} from "lucide-react";

type AdminEventLink = {
  id: string;
  name: string;
  status: string;
  description: string | null;
  eventDate: string | null;
  createdAt: string;
};

type AdminShellProps = {
  children: ReactNode;
  events: AdminEventLink[];
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const globalNavItems = [
  { href: "/admin", label: "대시보드", icon: Home },
  { href: "/admin/events/new", label: "새 행사", icon: Plus }
] as const;

const eventNavItems = [
  { key: "hub", label: "운영 허브", icon: LayoutDashboard, path: "" },
  { key: "check-in", label: "체크인", icon: BadgeCheck, path: "/check-in" },
  { key: "reservations", label: "예약", icon: Rows3, path: "/reservations" },
  { key: "schedule", label: "시간표", icon: Clock, path: "/schedule" },
  { key: "public", label: "예약 페이지", icon: ExternalLink, path: null }
] as const;

const eventStatusLabels: Record<string, string> = {
  DRAFT: "작성 중",
  PUBLISHED: "공개",
  CLOSED: "마감",
  ARCHIVED: "보관됨"
};

function getEventStatusLabel(status: string) {
  return eventStatusLabels[status] ?? status;
}

function AdminNavLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href;
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="admin-nav-item"
      data-active={active ? "true" : undefined}
      onClick={onNavigate}
    >
      <Icon aria-hidden="true" className="admin-nav-icon" />
      <span>{item.label}</span>
    </Link>
  );
}

function AdminSidebar({ events, onNavigate, onClose }: { events: AdminEventLink[]; onNavigate: () => void; onClose: () => void }) {
  const pathname = usePathname();
  const activeEvent = events.find((event) => {
    const baseHref = `/admin/events/${event.id}`;
    return pathname === baseHref || pathname.startsWith(`${baseHref}/`) || pathname === `/event/${event.id}`;
  }) ?? events[0];

  return (
    <aside className="admin-sidebar surface-flat">
      <div className="admin-sidebar-header">
        <Link href="/admin" className="admin-brand" onClick={onNavigate}>
          <span className="admin-brand-mark">
            <ShieldCheck aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black text-base-content">행사 관리</span>
            <span className="block truncate text-xs font-semibold text-base-content/50">Reservation Ops</span>
          </span>
        </Link>
        <button className="admin-sidebar-close" type="button" onClick={onClose} aria-label="메뉴 닫기">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <nav className="admin-sidebar-nav">
        <div className="admin-nav-section">
          <div className="admin-nav-section-label">Workspace</div>
          {globalNavItems.map((item) => (
            <AdminNavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>

        <details className="admin-event-switcher">
          <summary>
            <span className="admin-event-switcher-copy">
              <span className="admin-event-switcher-label">
                <CalendarDays aria-hidden="true" className="admin-nav-icon" />
                현재 행사
              </span>
              <span className="admin-event-switcher-title">{activeEvent?.name ?? "행사를 선택하세요"}</span>
              <span className="admin-event-switcher-date">{activeEvent?.eventDate ?? "날짜 미정"}</span>
            </span>
            <ChevronDown aria-hidden="true" className="admin-summary-chevron" />
          </summary>
          <div className="admin-event-options">
            {events.map((event) => {
              const baseHref = `/admin/events/${event.id}`;
              const eventActive = activeEvent?.id === event.id;
              return (
                <Link
                  key={event.id}
                  href={baseHref}
                  className="admin-event-option"
                  data-active={eventActive ? "true" : undefined}
                  onClick={onNavigate}
                >
                  <span className="admin-event-option-title">{event.name}</span>
                  <span className="admin-event-option-meta">
                    <span className="admin-event-option-date">{event.eventDate ?? "날짜 미정"}</span>
                    <span className="admin-event-option-status">{getEventStatusLabel(event.status)}</span>
                  </span>
                </Link>
              );
            })}
            {events.length === 0 && <div className="px-3 py-2 text-sm text-base-content/50">행사가 없습니다.</div>}
          </div>
        </details>

        <div className="admin-nav-section">
          <div className="admin-nav-section-label">Event Menu</div>
          {activeEvent ? (
            eventNavItems.map((item) => {
              const baseHref = `/admin/events/${activeEvent.id}`;
              const href = item.path === null ? `/event/${activeEvent.id}` : `${baseHref}${item.path}`;
              const Icon = item.icon;
              const active = pathname === href;
              return (
                <Link
                  key={item.key}
                  href={href}
                  className="admin-sub-nav-item"
                  data-active={active ? "true" : undefined}
                  onClick={onNavigate}
                >
                  <Icon aria-hidden="true" className="admin-nav-icon" />
                  <span>{item.label}</span>
                </Link>
              );
            })
          ) : (
            <div className="admin-empty-hint">행사를 선택하면 운영 메뉴가 표시됩니다.</div>
          )}
        </div>
      </nav>
    </aside>
  );
}

export function AdminShell({ children, events }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="admin-shell" data-sidebar-open={sidebarOpen ? "true" : undefined}>
      <div className="admin-mobile-topbar surface-flat">
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기">
          <Menu aria-hidden="true" className="h-4 w-4" />
          메뉴
        </button>
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-black">
          <ShieldCheck aria-hidden="true" className="h-4 w-4 text-[var(--app-blue)]" />
          행사 관리
        </Link>
      </div>

      <button
        className="admin-sidebar-overlay"
        type="button"
        aria-label="메뉴 닫기"
        onClick={() => setSidebarOpen(false)}
      />

      <AdminSidebar events={events} onNavigate={() => setSidebarOpen(false)} onClose={() => setSidebarOpen(false)} />
      <section className="admin-content min-w-0 flex-1">{children}</section>
    </div>
  );
}

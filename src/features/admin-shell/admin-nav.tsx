"use client";

import { Clapperboard, LayoutDashboard, Library, ScrollText, ShieldCheck, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", key: "dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/students", key: "students", icon: Users },
  { href: "/admin/content", key: "content", icon: Library },
  { href: "/admin/media", key: "media", icon: Clapperboard },
  { href: "/admin/audit", key: "audit", icon: ScrollText },
  { href: "/admin/account", key: "account", icon: ShieldCheck },
] as const;

export function AdminNav({ pending, onNavigate }: { pending: number; onNavigate?: () => void }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} className="grid gap-1">
      {ITEMS.map(({ href, key, icon: Icon, ...rest }) => {
        const active = "exact" in rest ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
            )}
          >
            <Icon className={cn("size-4", active && "text-gold")} aria-hidden />
            <span className="flex-1">{t(key)}</span>
            {key === "students" && pending > 0 && (
              <span
                className="rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-night"
                aria-label={t("pendingBadge", { count: pending })}
              >
                {pending}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

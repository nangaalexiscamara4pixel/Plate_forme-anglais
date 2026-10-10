"use client";

import { BookOpen, Home } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Navigation principale de l'espace étudiant (enrichie en phase 6). */
export function StudentNav() {
  const t = useTranslations("app.nav");
  const pathname = usePathname();
  const items = [
    { href: "/app", label: t("home"), icon: Home, active: pathname === "/app" },
    { href: "/app/learn", label: t("courses"), icon: BookOpen, active: pathname.startsWith("/app/learn") },
  ];
  return (
    <nav aria-label={t("label")} className="flex items-center gap-1">
      {items.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            active && "bg-accent font-medium text-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden />
          <span className="max-sm:sr-only">{label}</span>
        </Link>
      ))}
    </nav>
  );
}

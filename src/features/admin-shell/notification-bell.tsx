"use client";

import { Bell, UserPlus } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markNotificationsReadAction } from "@/features/account/actions";
import { Link } from "@/i18n/navigation";

export type BellItem = {
  id: string;
  type: string;
  createdAt: Date;
  readAt: Date | null;
  studentId?: string;
  name?: string;
};

export function NotificationBell({ items, unread }: { items: BellItem[]; unread: number }) {
  const t = useTranslations("admin.notifications");
  const format = useFormatter();
  const [, startTransition] = useTransition();

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open && unread > 0) startTransition(() => markNotificationsReadAction());
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("label", { count: unread })}>
          <Bell className="size-4" aria-hidden />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>{t("title")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem key={n.id} asChild>
              <Link href={n.studentId ? `/admin/students/${n.studentId}` : "/admin"} className="flex items-start gap-3">
                <UserPlus className="mt-0.5 size-4 text-brand-ink" aria-hidden />
                <span className="grid gap-0.5">
                  <span className={n.readAt ? "text-muted-foreground" : "font-medium"}>
                    {n.type === "registration.pending" ? t("registration", { name: n.name ?? "?" }) : n.type}
                  </span>
                  <span className="text-xs text-muted-foreground">{format.relativeTime(n.createdAt)}</span>
                </span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

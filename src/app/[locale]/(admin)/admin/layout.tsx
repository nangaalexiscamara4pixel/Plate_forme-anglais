import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminNav } from "@/features/admin-shell/admin-nav";
import { AdminMobileNav } from "@/features/admin-shell/mobile-nav";
import { NotificationBell, type BellItem } from "@/features/admin-shell/notification-bell";
import { pendingCount } from "@/features/students/queries";
import { Link } from "@/i18n/navigation";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/dal/guards";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Garde serveur : rôle ADMIN + 2FA activée + session < 12 h (sinon 404 / redirection).
  const admin = await requireAdmin();
  const t = await getTranslations("admin");
  const [pending, notifications, unread] = await Promise.all([
    pendingCount(),
    db.notification.findMany({ where: { userId: admin.userId }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.notification.count({ where: { userId: admin.userId, readAt: null } }),
  ]);
  const bellItems: BellItem[] = notifications.map((n) => {
    const payload = (n.payload ?? {}) as { studentId?: string; name?: string };
    return { id: n.id, type: n.type, createdAt: n.createdAt, readAt: n.readAt, studentId: payload.studentId, name: payload.name };
  });

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground lg:flex">
        <Link href="/admin" className="mb-8 rounded-md px-2 pt-2">
          <Logo className="[&_.text-gold-ink]:text-gold" />
        </Link>
        <AdminNav pending={pending} />
        <div className="mt-auto rounded-lg border border-sidebar-border px-3 py-2 text-xs text-sidebar-foreground/70">
          <p className="truncate font-medium text-sidebar-foreground">{admin.name}</p>
          <p className="truncate">{admin.email}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <AdminMobileNav pending={pending} />
            <span className="text-xs font-semibold tracking-[0.25em] text-gold-ink uppercase">{t("title")}</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell items={bellItems} unread={unread} />
            <LocaleSwitcher />
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}

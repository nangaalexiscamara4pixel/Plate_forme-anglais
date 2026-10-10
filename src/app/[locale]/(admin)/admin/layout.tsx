import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/server/dal/guards";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Garde serveur : rôle ADMIN + 2FA activée + session < 12 h (sinon 404 / redirection).
  await requireAdmin();
  const t = await getTranslations("admin");
  return (
    <div className="min-h-dvh">
      <header className="bg-night text-night-foreground">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="rounded-md">
              <Logo className="[&_.text-gold-ink]:text-gold" />
            </Link>
            <Badge variant="outline" className="border-gold/40 text-gold">
              {t("title")}
            </Badge>
          </div>
          <div className="flex items-center gap-1 [&_button]:text-night-foreground [&_button:hover]:bg-white/10">
            <LocaleSwitcher />
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-10">
        {children}
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { StudentNav } from "@/features/learn/components/student-nav";
import { Link } from "@/i18n/navigation";
import { requireApprovedStudent } from "@/server/dal/guards";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function StudentLayout({ children }: { children: ReactNode }) {
  // Garde serveur : session valide + compte APPROUVÉ + rôle étudiant.
  const viewer = await requireApprovedStudent();
  return (
    <div className="min-h-dvh">
      {viewer.impersonatedBy && <ImpersonationBanner studentName={viewer.name} />}
      <header className="border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/app" className="rounded-md">
              <Logo collapseOnMobile />
            </Link>
            <StudentNav />
          </div>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
            {!viewer.impersonatedBy && <SignOutButton />}
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-10">
        {children}
      </main>
    </div>
  );
}

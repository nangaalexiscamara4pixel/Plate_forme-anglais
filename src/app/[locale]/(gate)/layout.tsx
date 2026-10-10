import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getViewer } from "@/server/dal/viewer";

/** Portail des comptes non approuvés : aucune navigation vers le contenu. */
export default async function GateLayout({ children }: { children: ReactNode }) {
  // Les pages du portail appliquent leur propre garde ; ici on n'affiche que le bandeau éventuel.
  const viewer = await getViewer();
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-grain">
      {viewer?.impersonatedBy && <ImpersonationBanner studentName={viewer.name} />}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,oklch(0.53_0.2_25/0.16),transparent_65%)]"
        aria-hidden
      />
      <header className="relative flex items-center justify-between p-4 sm:p-6">
        <Logo />
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          {!viewer?.impersonatedBy && <SignOutButton />}
        </div>
      </header>
      <main id="main" className="relative flex flex-1 items-start justify-center px-4 pt-8 pb-16 sm:items-center sm:pt-0">
        {children}
      </main>
    </div>
  );
}

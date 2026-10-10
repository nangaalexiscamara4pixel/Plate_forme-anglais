import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { GlobeMark, Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";

/** Mise en page des écrans d'authentification : panneau éditorial + formulaire. */
export async function AuthShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("auth");
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-night text-night-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -right-40 top-1/2 size-[640px] -translate-y-1/2 text-white/[0.07]" aria-hidden>
          <GlobeMark subtle className="size-full" />
        </div>
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,oklch(0.74_0.09_85/0.18),transparent_55%)]"
          aria-hidden
        />
        <Link href="/" className="relative w-fit rounded-md">
          <Logo className="[&_.text-gold-ink]:text-gold" />
        </Link>
        <figure className="relative max-w-md">
          <blockquote className="font-display text-3xl leading-snug font-light text-balance">{t("shellQuote")}</blockquote>
          <figcaption className="mt-4 text-sm tracking-widest text-gold uppercase">{t("shellQuoteAuthor")}</figcaption>
        </figure>
        <div className="relative flex gap-3 text-xs tracking-[0.3em] text-white/50 uppercase">
          <span>A1</span>·<span>A2</span>·<span>B1</span>·<span>B2</span>
        </div>
      </aside>

      <div className="flex flex-col">
        <header className="flex items-center justify-between p-4 sm:p-6">
          <Link href="/" className="rounded-md lg:invisible">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </header>
        <main id="main" className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-6">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8 space-y-2">
      <h1 className="text-3xl font-medium sm:text-4xl">{title}</h1>
      {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

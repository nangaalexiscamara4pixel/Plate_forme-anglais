import { ArrowRight, BookOpen, Ear, Mic, PenLine, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LEVEL_CODES, LEVEL_THEME } from "@/components/brand/levels";
import { GlobeMark, Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Page d'accueil provisoire (phase 1). La version complète — globe animé, méthode,
// déroulé des cours Meet, témoignages, FAQ — est livrée en phase 7.
const SKILLS = [
  { code: "READING", icon: BookOpen },
  { code: "SPEAKING", icon: Mic },
  { code: "WRITING", icon: PenLine },
  { code: "LISTENING", icon: Ear },
] as const;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const tl = await getTranslations("levels");
  const ts = await getTranslations("skills");

  return (
    <div className="min-h-dvh">
      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 text-night-foreground">
          <Logo collapseOnMobile className="[&_.text-gold-ink]:text-gold" />
          <nav className="flex items-center gap-1 [&_button]:text-night-foreground [&_button:hover]:bg-white/10">
            <LocaleSwitcher />
            <ThemeToggle />
            <Button asChild variant="ghost" className="text-night-foreground hover:bg-white/10 hover:text-white">
              <Link href="/sign-in">{tc("signIn")}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="relative overflow-hidden bg-night pt-36 pb-28 text-night-foreground">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_40%,oklch(0.74_0.09_85/0.22),transparent_50%)]"
            aria-hidden
          />
          <GlobeMark subtle className="pointer-events-none absolute top-16 right-0 hidden size-[520px] text-white/[0.08] md:block" />
          <div className="relative mx-auto max-w-6xl px-4">
            <p className="mb-6 text-xs font-semibold tracking-[0.35em] text-gold uppercase">{t("eyebrow")}</p>
            <h1 className="max-w-3xl text-4xl leading-[1.1] font-light text-balance sm:text-6xl">{t("title")}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75">{t("subtitle")}</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gold text-night hover:bg-gold/90">
                <Link href="/sign-up">
                  {tc("requestAccess")} <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <a href="#levels">{t("secondaryCta")}</a>
              </Button>
            </div>
          </div>
        </section>

        <section id="levels" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-24">
          <h2 className="text-3xl font-medium sm:text-4xl">{t("levelsTitle")}</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">{t("levelsSubtitle")}</p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {LEVEL_CODES.map((code) => {
              const theme = LEVEL_THEME[code];
              const Icon = theme.icon;
              return (
                <article key={code} className="group rounded-2xl border bg-card p-6 transition-shadow hover:shadow-lg">
                  <span className={cn("mb-6 flex size-12 items-center justify-center rounded-xl text-white", theme.bg)}>
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <p className={cn("text-sm font-semibold tracking-widest", theme.text)}>{code}</p>
                  <h3 className="mt-1 text-2xl">{tl(`${code}.name`)}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{tl(`${code}.tagline`)}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y bg-card/50">
          <div className="mx-auto max-w-6xl px-4 py-24">
            <h2 className="text-3xl font-medium sm:text-4xl">{t("skillsTitle")}</h2>
            <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {SKILLS.map(({ code, icon: Icon }) => (
                <li key={code} className="flex items-center gap-4">
                  <span className="flex size-12 items-center justify-center rounded-full border border-gold/40 text-gold-ink">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-display text-xl">{ts(code)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-24 text-center">
          <ShieldCheck className="mx-auto mb-6 size-10 text-gold-ink" aria-hidden />
          <h2 className="text-3xl font-medium">{t("accessTitle")}</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">{t("accessBody")}</p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/sign-up">{tc("requestAccess")}</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <p>{t("footer", { year: new Date().getFullYear() })}</p>
          <Link href="/privacy" className="hover:text-foreground">
            {t("privacy")}
          </Link>
        </div>
      </footer>
    </div>
  );
}

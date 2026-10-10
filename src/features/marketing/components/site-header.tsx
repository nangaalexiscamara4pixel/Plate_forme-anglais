"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/#formations", key: "courses" },
  { href: "/#competences", key: "skills" },
  { href: "/#cours-en-direct", key: "live" },
  { href: "/#temoignages", key: "testimonials" },
  { href: "/#faq", key: "faq" },
] as const;

/** En-tête du site public : collant, ombre au défilement, menu latéral sur mobile. */
export function SiteHeader() {
  const t = useTranslations("site.nav");
  const tc = useTranslations("common");
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("sticky top-0 z-40 border-b bg-background/90 backdrop-blur transition-shadow", scrolled ? "border-border shadow-sm" : "border-transparent")}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-[72px]">
        <Link href="/" className="rounded-md" aria-label={tc("brand")}>
          <Logo collapseOnMobile />
        </Link>

        <nav aria-label={t("label")} className="hidden lg:block">
          <ul className="flex items-center gap-7 text-sm font-medium">
            {NAV.map((item) => (
              <li key={item.key}>
                <Link href={item.href} className="text-foreground/80 transition-colors hover:text-foreground">
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <Link href="/sign-in" className="hidden px-2 text-sm font-medium text-foreground/80 hover:text-foreground sm:inline">
            {tc("signIn")}
          </Link>
          <Button asChild size="sm" className="hidden bg-gold text-night hover:bg-gold/90 sm:inline-flex">
            <Link href="/sign-up">{tc("requestAccess")}</Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("open")}>
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-6">
              <SheetTitle className="sr-only">{t("label")}</SheetTitle>
              <Logo />
              <nav aria-label={t("label")} className="mt-8">
                <ul className="grid gap-1">
                  {NAV.map((item) => (
                    <li key={item.key}>
                      <Link href={item.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 font-medium hover:bg-accent">
                        {t(item.key)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="mt-8 grid gap-2">
                <Button asChild className="bg-gold text-night hover:bg-gold/90">
                  <Link href="/sign-up">{tc("requestAccess")}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/sign-in">{tc("signIn")}</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

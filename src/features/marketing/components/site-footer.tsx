import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";
import { SOCIAL_LINKS } from "../site-config";
import { NewsletterForm } from "./newsletter-form";

const SOCIAL_LABEL = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube" } as const;

export async function SiteFooter() {
  const t = await getTranslations("site.footer");
  const tn = await getTranslations("site.nav");
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.2fr_1fr_1.4fr]">
        <div className="grid content-start gap-4">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">{t("tagline")}</p>
          {SOCIAL_LINKS.length > 0 && (
            <ul className="flex gap-3">
              {SOCIAL_LINKS.map((s) => (
                <li key={s.network}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground">
                    {SOCIAL_LABEL[s.network]}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <nav aria-label={t("linksLabel")}>
          <ul className="grid gap-2 text-sm">
            <li>
              <Link href="/#formations" className="text-muted-foreground hover:text-foreground">
                {tn("courses")}
              </Link>
            </li>
            <li>
              <Link href="/#cours-en-direct" className="text-muted-foreground hover:text-foreground">
                {tn("live")}
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="text-muted-foreground hover:text-foreground">
                {tn("faq")}
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link href="/sign-in" className="text-muted-foreground hover:text-foreground">
                {t("studentArea")}
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className="font-display text-lg">{t("newsletterTitle")}</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">{t("newsletterText")}</p>
          <NewsletterForm />
        </div>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground">{t("copyright", { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}

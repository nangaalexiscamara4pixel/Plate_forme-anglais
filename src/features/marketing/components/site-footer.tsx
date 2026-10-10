import { Mail, MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";
import { CONTACT, SOCIAL_LINKS, whatsappUrl } from "../site-config";
import { NewsletterForm } from "./newsletter-form";

const SOCIAL_LABEL = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube", portfolio: "Portfolio" } as const;

export async function SiteFooter() {
  const t = await getTranslations("site.footer");
  const tn = await getTranslations("site.nav");
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 lg:grid-cols-[1.1fr_0.7fr_1.35fr_1.35fr]">
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
          <p className="font-display text-lg">{t("contactTitle")}</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">{t("contactText")}</p>
          <ul className="grid gap-3 text-sm">
            {CONTACT.whatsapp.map((n) => (
              <li key={n.e164}>
                <a
                  href={whatsappUrl(n.e164)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("whatsappLabel", { number: n.display })}
                  className="group inline-flex items-center gap-2.5 font-medium hover:text-brand-ink"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-[#25D366] text-white transition-transform group-hover:scale-110">
                    <MessageCircle className="size-4" aria-hidden />
                  </span>
                  <span dir="ltr">{n.display}</span>
                </a>
              </li>
            ))}
            <li>
              <a href={`mailto:${CONTACT.email}`} className="group inline-flex items-center gap-2.5 font-medium [overflow-wrap:anywhere] hover:text-brand-ink">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-night text-white transition-transform group-hover:scale-110">
                  <Mail className="size-4" aria-hidden />
                </span>
                {CONTACT.email}
              </a>
            </li>
          </ul>
        </div>
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

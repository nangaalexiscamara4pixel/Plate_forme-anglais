import { MailX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { unsubscribe } from "@/features/marketing/newsletter";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { robots: { index: false }, referrer: "no-referrer" };

/** Désinscription en un clic depuis l'email ; même message que le lien soit valide ou non. */
export default async function NewsletterUnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (token) await unsubscribe(token);
  const t = await getTranslations("site.newsletter");
  const tc = await getTranslations("common");
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <MailX className="mx-auto size-12 text-muted-foreground" aria-hidden />
      <h1 className="mt-6 text-3xl font-medium">{t("unsubscribedTitle")}</h1>
      <p className="mt-3 text-muted-foreground">{t("unsubscribedText")}</p>
      <Button asChild className="mt-8">
        <Link href="/">{tc("backHome")}</Link>
      </Button>
    </div>
  );
}

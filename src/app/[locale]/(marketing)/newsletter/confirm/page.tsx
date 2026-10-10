import { CheckCircle2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { confirmSubscription } from "@/features/marketing/newsletter";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { robots: { index: false }, referrer: "no-referrer" };

export default async function NewsletterConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const ok = token ? await confirmSubscription(token) : false;
  const t = await getTranslations("site.newsletter");
  const tc = await getTranslations("common");
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <Icon className={ok ? "mx-auto size-12 text-success" : "mx-auto size-12 text-muted-foreground"} aria-hidden />
      <h1 className="mt-6 text-3xl font-medium">{ok ? t("confirmedTitle") : t("invalidTitle")}</h1>
      <p className="mt-3 text-muted-foreground">{ok ? t("confirmedText") : t("invalidText")}</p>
      <Button asChild className="mt-8">
        <Link href="/">{tc("backHome")}</Link>
      </Button>
    </div>
  );
}

import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { AuthHeading } from "@/features/auth/components/auth-shell";
import { TwoFactorSetup } from "@/features/auth/components/two-factor-forms";
import { redirect } from "@/i18n/navigation";
import { requireViewer } from "@/server/dal/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.setup2fa");
  return { title: t("title"), robots: { index: false } };
}

export default async function SetupTwoFactorPage() {
  const viewer = await requireViewer();
  if (viewer.twoFactorEnabled) redirect({ href: viewer.role === "ADMIN" ? "/admin" : "/app", locale: await getLocale() });
  const t = await getTranslations("auth.setup2fa");
  return (
    <>
      <AuthHeading title={t("title")} subtitle={viewer.role === "ADMIN" ? t("subtitleAdmin") : t("subtitle")} />
      <TwoFactorSetup />
    </>
  );
}

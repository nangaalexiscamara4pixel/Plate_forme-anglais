import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/features/auth/components/auth-shell";
import { TwoFactorChallenge } from "@/features/auth/components/two-factor-forms";
import { nextPathSchema } from "@/features/auth/schemas";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.twoFactor");
  return { title: t("title"), robots: { index: false } };
}

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const t = await getTranslations("auth.twoFactor");
  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      <TwoFactorChallenge next={nextPathSchema.parse(next)} />
    </>
  );
}

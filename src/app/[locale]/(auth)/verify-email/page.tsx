import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/features/auth/components/auth-shell";
import { ResendVerificationForm } from "@/features/auth/components/password-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.verifyEmail");
  return { title: t("title"), robots: { index: false } };
}

export default async function VerifyEmailPage() {
  const t = await getTranslations("auth.verifyEmail");
  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("body")} />
      <ResendVerificationForm />
    </>
  );
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/features/auth/components/auth-shell";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { nextPathSchema } from "@/features/auth/schemas";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signIn");
  return { title: t("title"), robots: { index: false } };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  const t = await getTranslations("auth.signIn");
  return (
    <>
      <AuthHeading title={t("title")} subtitle={reason === "expired" ? t("expired") : t("subtitle")} />
      <SignInForm next={nextPathSchema.parse(next)} />
    </>
  );
}

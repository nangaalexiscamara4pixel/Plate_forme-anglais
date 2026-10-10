import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { AuthHeading } from "@/features/auth/components/auth-shell";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { countryOptions } from "@/lib/countries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signUp");
  return { title: t("title") };
}

export default async function SignUpPage() {
  const t = await getTranslations("auth.signUp");
  const locale = await getLocale();
  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      <SignUpForm countries={countryOptions(locale)} timezones={Intl.supportedValuesOf("timeZone")} />
    </>
  );
}

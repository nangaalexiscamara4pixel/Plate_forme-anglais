import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AuthHeading } from "@/features/auth/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/components/password-forms";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.reset");
  return { title: t("title"), robots: { index: false }, referrer: "no-referrer" };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const t = await getTranslations("auth.reset");
  const tf = await getTranslations("auth.forgot");
  const valid = token && !error && /^[\w-]{10,512}$/.test(token);

  return (
    <>
      <AuthHeading title={t("title")} subtitle={valid ? t("subtitle") : undefined} />
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="grid gap-5">
          <Alert variant="destructive">
            <AlertDescription>{t("missingToken")}</AlertDescription>
          </Alert>
          <Button asChild variant="outline">
            <Link href="/forgot-password">{tf("submit")}</Link>
          </Button>
        </div>
      )}
    </>
  );
}

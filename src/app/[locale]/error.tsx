"use client";

import { useTranslations } from "next-intl";
import { ErrorScreen } from "@/components/error-screen";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors.serverError");
  return <ErrorScreen code="500" title={t("title")} body={t("body")} action={<Button onClick={reset}>{t("retry")}</Button>} />;
}

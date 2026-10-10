import { getTranslations } from "next-intl/server";
import { ErrorScreen } from "@/components/error-screen";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export const metadata = { robots: { index: false } };

export default async function ForbiddenPage() {
  const t = await getTranslations("errors.forbiddenPage");
  const tc = await getTranslations("common");
  return (
    <ErrorScreen
      code="403"
      title={t("title")}
      body={t("body")}
      action={
        <Button asChild>
          <Link href="/">{tc("backHome")}</Link>
        </Button>
      }
    />
  );
}

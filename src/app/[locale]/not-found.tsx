import { useTranslations } from "next-intl";
import { ErrorScreen } from "@/components/error-screen";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("errors.notFound");
  const tc = useTranslations("common");
  return (
    <ErrorScreen
      code="404"
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

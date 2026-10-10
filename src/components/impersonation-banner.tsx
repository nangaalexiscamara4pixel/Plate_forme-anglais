import { Eye, LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { stopImpersonationAction } from "@/features/impersonation/actions";

/**
 * Bandeau rouge permanent affiché quand un administrateur consulte la plateforme
 * « en tant que » un étudiant. Mode lecture seule ; le bouton rétablit la session admin.
 */
export async function ImpersonationBanner({ studentName }: { studentName: string }) {
  const t = await getTranslations("impersonation");
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-destructive px-4 py-2 text-sm font-medium text-white"
    >
      <span className="flex items-center gap-2">
        <Eye className="size-4" aria-hidden />
        {t("banner", { name: studentName })}
      </span>
      <form action={stopImpersonationAction}>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/60 px-3 py-1 text-xs font-semibold hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
        >
          <LogOut className="size-3.5" aria-hidden />
          {t("exit")}
        </button>
      </form>
    </div>
  );
}

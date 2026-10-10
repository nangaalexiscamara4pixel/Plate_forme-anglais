import { Ban, CheckCircle2, ChevronLeft, ChevronRight, Hourglass, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { LEVEL_THEME, type LevelCode } from "@/components/brand/levels";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Éléments d'interface communs du back-office (composants serveur). */

const STATUS_STYLE = {
  PENDING: { icon: Hourglass, cls: "border-warning/40 bg-warning/10 text-foreground [&_svg]:text-warning" },
  APPROVED: { icon: CheckCircle2, cls: "border-success/40 bg-success/10 text-foreground [&_svg]:text-success" },
  REJECTED: { icon: XCircle, cls: "border-border bg-muted text-muted-foreground" },
  SUSPENDED: { icon: Ban, cls: "border-destructive/40 bg-destructive/10 text-foreground [&_svg]:text-destructive" },
} as const;

export type StatusKey = keyof typeof STATUS_STYLE;

/** Statut d'un compte : icône + libellé (jamais la couleur seule). */
export async function StatusBadge({ status }: { status: StatusKey }) {
  const t = await getTranslations("admin.statusBadge");
  const { icon: Icon, cls } = STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", cls)}>
      <Icon className="size-3.5" aria-hidden />
      {t(status)}
    </span>
  );
}

export function LevelBadge({ code, name }: { code: string; name?: string }) {
  const theme = LEVEL_THEME[code as LevelCode];
  if (!theme) return null;
  const Icon = theme.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={cn("flex size-5 items-center justify-center rounded text-white", theme.bg)}>
        <Icon className="size-3" aria-hidden />
      </span>
      <span className="font-medium">{code}</span>
      {name && <span className="text-muted-foreground">{name}</span>}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-3xl font-medium">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Pagination par liens (fonctionne sans JavaScript, conserve les filtres). */
export async function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  const t = await getTranslations("admin.pagination");
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={t("label")} className="mt-6 flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{t("pageOf", { page, pageCount })}</span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefFor(page - 1)} rel="prev">
              <ChevronLeft className="size-4" aria-hidden /> {t("previous")}
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="size-4" aria-hidden /> {t("previous")}
          </Button>
        )}
        {page < pageCount ? (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefFor(page + 1)} rel="next">
              {t("next")} <ChevronRight className="size-4" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            {t("next")} <ChevronRight className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </nav>
  );
}

export function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-gold-ink">{icon}</div>
      <p className="font-medium">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
    </div>
  );
}

/** Construit une query string en omettant les valeurs vides. */
export function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

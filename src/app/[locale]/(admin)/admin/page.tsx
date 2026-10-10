import { Activity, ArrowRight, Inbox } from "lucide-react";
import { actionKey } from "@/features/audit/format";
import { getFormatter, getTranslations } from "next-intl/server";
import { LEVEL_THEME, type LevelCode } from "@/components/brand/levels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegistrationsChart } from "@/features/admin-shell/registrations-chart";
import { EmptyState, PageHeader } from "@/features/admin-shell/ui";
import { PendingApplication } from "@/features/approval/components/pending-application";
import { getAdminDashboard } from "@/features/students/queries";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/dal/guards";

const STATUSES = ["PENDING", "APPROVED", "SUSPENDED", "REJECTED"] as const;

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  const t = await getTranslations("admin");
  const ta = await getTranslations("admin.auditActions");
  const format = await getFormatter();
  const data = await getAdminDashboard();
  const maxLevel = Math.max(1, ...data.levels.map((l) => l.count));
  const approvedTotal = data.statuses.APPROVED;

  return (
    <div className="space-y-8">
      <PageHeader title={t("dashboard.title")} description={t("dashboard.subtitle", { name: admin.name.split(" ")[0] ?? "" })} />

      {/* Tuiles de statut : des nombres, pas un graphique */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label={t("dashboard.statusesLabel")}>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/students?status=${s}`}
            className={cn(
              "rounded-xl border bg-card p-5 transition-shadow hover:shadow-md focus-visible:ring-2",
              s === "PENDING" && data.statuses.PENDING > 0 && "border-brand/60 ring-2 ring-brand/20",
            )}
          >
            <p className="text-sm text-muted-foreground">{t(`stats.${s}`)}</p>
            <p className="mt-1 font-display text-4xl">{data.statuses[s]}</p>
          </Link>
        ))}
      </section>

      {data.pending.length > 0 && (
        <Card className="border-brand/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-xl font-medium">{t("pendingTitle")}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/students?status=PENDING">
                {t("dashboard.seeAll")} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {data.pending.map((u) => (
                <PendingApplication
                  key={u.id}
                  student={{
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    meta: [
                      t("registeredOn", { date: format.dateTime(u.createdAt, { dateStyle: "medium", timeZone: admin.timezone }) }),
                      u.profile?.country,
                      u.profile?.timezone,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  }}
                  levels={data.levels}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="font-display text-xl font-medium">{t("dashboard.registrationsTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.registrationsTotal", { count: data.registrations.reduce((a, d) => a + d.count, 0) })}
            </p>
          </CardHeader>
          <CardContent>
            <RegistrationsChart data={data.registrations} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-xl font-medium">{t("dashboard.byLevelTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("dashboard.byLevelSubtitle", { count: approvedTotal })}</p>
          </CardHeader>
          <CardContent>
            {/* Barres horizontales étiquetées directement : la couleur suit l'identité du niveau, le texte reste en encre neutre */}
            <ul className="grid gap-4">
              {data.levels.map((l) => {
                const theme = LEVEL_THEME[l.code as LevelCode];
                const Icon = theme.icon;
                return (
                  <li key={l.id}>
                    <Link href={`/admin/students?status=APPROVED&level=${l.code}`} className="group grid gap-1.5 rounded-md">
                      <span className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Icon className={cn("size-4", theme.text)} aria-hidden />
                          <span className="font-medium">{l.code}</span>
                          <span className="text-muted-foreground">{l.name}</span>
                        </span>
                        <span className="font-medium tabular-nums">{l.count}</span>
                      </span>
                      <span className="h-2 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn("block h-full rounded-full transition-[width] group-hover:opacity-80", theme.bg)}
                          style={{ width: `${(l.count / maxLevel) * 100}%` }}
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display text-xl font-medium">{t("dashboard.activityTitle")}</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/audit">
              {t("dashboard.fullLog")} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {data.recentActivity.length === 0 ? (
            <EmptyState icon={<Activity className="size-5" aria-hidden />} title={t("dashboard.noActivity")} />
          ) : (
            <ol className="divide-y">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span>
                    <span className="font-medium">{a.actor?.name ?? t("audit.system")}</span>{" "}
                    <span className="text-muted-foreground">{ta.has(actionKey(a.action)) ? ta(actionKey(a.action)) : a.action}</span>
                  </span>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={a.createdAt.toISOString()}>
                    {format.relativeTime(a.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {data.pending.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Inbox className="size-4" aria-hidden /> {t("pendingEmpty")}
        </p>
      )}
    </div>
  );
}

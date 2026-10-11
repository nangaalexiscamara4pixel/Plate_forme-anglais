import { CheckCircle2, Info, Radio } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/features/admin-shell/ui";
import { CreateSessionForm } from "@/features/live/components/create-session-form";
import { SessionList } from "@/features/live/components/session-list";
import { listAdminSessions, liveKitConfigured, serverNow } from "@/features/live/server";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/dal/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("live.admin");
  return { title: t("title") };
}

/** Back-office : programmation des cours en direct et accès enseignant aux salles virtuelles. */
export default async function AdminLivePage() {
  const admin = await requireAdmin();
  const t = await getTranslations("live.admin");
  const [sessions, levels] = await Promise.all([
    listAdminSessions(),
    db.level.findMany({ orderBy: { order: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: admin.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const configured = liveKitConfigured();

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid gap-8 xl:grid-cols-[1fr_24rem]">
        <section aria-label={t("upcoming")} className="order-2 xl:order-1">
          {sessions.length === 0 ? (
            <EmptyState icon={<Radio className="size-6" aria-hidden />} title={t("emptyTitle")} body={t("emptyText")} />
          ) : (
            <SessionList
              host
              serverNow={serverNow()}
              items={sessions.map((s) => ({
                id: s.id,
                title: s.title,
                description: s.description,
                startsAt: s.startsAt.toISOString(),
                durationMin: s.durationMin,
                joinWindowMin: s.joinWindowMin,
                status: s.status,
                levelCode: s.level.code,
                present: s._count.presences,
              }))}
            />
          )}
        </section>
        <div className="order-1 grid content-start gap-4 xl:order-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-sans text-base">{t("newSession")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateSessionForm levels={levels} defaultDate={today} timezone={admin.timezone} />
            </CardContent>
          </Card>
          <p
            className={
              configured
                ? "flex gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200"
                : "flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100"
            }
          >
            {configured ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden />}
            {configured ? t("liveKitOn") : t("liveKitOff")}
          </p>
        </div>
      </div>
    </div>
  );
}

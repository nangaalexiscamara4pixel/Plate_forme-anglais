import { ArrowRight, Inbox, Mic, NotebookPen, PenLine } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, LevelBadge, PageHeader } from "@/features/admin-shell/ui";
import { AssignmentForm } from "@/features/assignments/components/assignment-form";
import { listAdminAssignments, listReviewQueue } from "@/features/assignments/server";
import { PublicationBadge } from "@/features/content/components/publication";
import { Link } from "@/i18n/navigation";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/dal/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assignments.admin");
  return { title: t("pageTitle") };
}

/** Back-office : copies à corriger, devoirs, création. */
export default async function AdminAssignmentsPage() {
  await requireAdmin();
  const t = await getTranslations("assignments.admin");
  const format = await getFormatter();
  const [queue, assignments, levels] = await Promise.all([
    listReviewQueue(),
    listAdminAssignments(),
    db.level.findMany({ orderBy: { order: "asc" }, select: { id: true, code: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader title={t("pageTitle")} description={t("pageSubtitle")} />
      <div className="grid gap-8 xl:grid-cols-[1fr_24rem]">
        <div className="order-2 grid content-start gap-8 xl:order-1">
          <section aria-labelledby="queue-title">
            <h2 id="queue-title" className="mb-3 flex items-center gap-2 font-display text-xl">
              <Inbox className="size-5 text-brand-ink" aria-hidden /> {t("queue", { count: queue.length })}
            </h2>
            {queue.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">{t("queueEmpty")}</p>
            ) : (
              <ul className="grid gap-2">
                {queue.map((s) => (
                  <li key={s.id}>
                    <Link href={`/admin/assignments/submissions/${s.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm transition hover:shadow-md">
                      {s.assignment.skill === "WRITING" ? <PenLine className="size-5 text-brand-ink" aria-hidden /> : <Mic className="size-5 text-brand-ink" aria-hidden />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{s.user.name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {s.assignment.title}
                          {s.version > 1 && ` · ${t("versionN", { n: s.version })}`}
                        </p>
                      </div>
                      {s.assignment.level && <LevelBadge code={s.assignment.level.code} />}
                      <span className="hidden text-xs text-muted-foreground sm:block">{s.submittedAt && format.relativeTime(s.submittedAt)}</span>
                      <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="list-title">
            <h2 id="list-title" className="mb-3 font-display text-xl">
              {t("list")}
            </h2>
            {assignments.length === 0 ? (
              <EmptyState icon={<NotebookPen className="size-6" aria-hidden />} title={t("emptyTitle")} body={t("emptyText")} />
            ) : (
              <ul className="grid gap-2">
                {assignments.map((a) => (
                  <li key={a.id}>
                    <Link href={`/admin/assignments/${a.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md">
                      {a.skill === "WRITING" ? <PenLine className="size-5 text-muted-foreground" aria-hidden /> : <Mic className="size-5 text-muted-foreground" aria-hidden />}
                      <span className="min-w-0 flex-1 font-medium">{a.title}</span>
                      {a.level && <LevelBadge code={a.level.code} />}
                      <span className="text-sm text-muted-foreground">{t("submissionsCount", { count: a._count.submissions })}</span>
                      {a.pending > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">{t("pendingCount", { count: a.pending })}</span>}
                      <PublicationBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <Card className="order-1 h-fit xl:order-2">
          <CardHeader>
            <CardTitle className="font-sans text-base">{t("newAssignment")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AssignmentForm levels={levels} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

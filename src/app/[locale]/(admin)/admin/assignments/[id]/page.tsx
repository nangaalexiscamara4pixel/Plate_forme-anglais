import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LevelBadge } from "@/features/admin-shell/ui";
import { deleteAssignmentAction, setAssignmentStatusAction } from "@/features/assignments/actions";
import { AssignmentForm } from "@/features/assignments/components/assignment-form";
import { MaterialsEditor } from "@/features/assignments/components/materials";
import { getAdminAssignment } from "@/features/assignments/server";
import { PublishBar } from "@/features/exercises/components/publish-bar";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/dal/guards";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const a = await db.assignment.findUnique({ where: { id }, select: { title: true } });
  return { title: a?.title ?? "—" };
}

/** Devoir : publication, copies reçues, paramètres. */
export default async function AdminAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const assignment = await getAdminAssignment(id);
  if (!assignment) notFound();
  const t = await getTranslations("assignments.admin");
  const ts = await getTranslations("assignments.student.status");
  const format = await getFormatter();
  const levels = await db.level.findMany({ orderBy: { order: "asc" }, select: { id: true, code: true, name: true } });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/assignments" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> {t("back")}
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              {assignment.level && <LevelBadge code={assignment.level.code} />} {t(`skills.${assignment.skill}`)}
            </p>
            <h1 className="text-3xl font-medium">{assignment.title}</h1>
          </div>
          <PublishBar
            id={assignment.id}
            status={assignment.status}
            setStatus={setAssignmentStatusAction}
            remove={deleteAssignmentAction}
            afterDelete="/admin/assignments"
            confirmDelete={t("confirmDelete", { title: assignment.title })}
          />
        </div>
      </div>
      <div className="grid gap-8 xl:grid-cols-[1fr_24rem]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="font-sans text-base">{t("submissions", { count: assignment.submissions.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            {assignment.submissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noSubmissions")}</p>
            ) : (
              <ul className="divide-y">
                {assignment.submissions.map((s) => (
                  <li key={s.id}>
                    <Link href={`/admin/assignments/submissions/${s.id}`} className="flex flex-wrap items-center gap-3 py-3 hover:bg-muted/40">
                      <span className="min-w-0 flex-1 font-medium">
                        {s.user.name}
                        {s.version > 1 && <span className="ml-2 text-xs text-muted-foreground">{t("versionN", { n: s.version })}</span>}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {assignment.skill === "WRITING" ? t("wordsCount", { count: s.wordCount ?? 0 }) : `${Math.floor((s.durationSec ?? 0) / 60)}:${String((s.durationSec ?? 0) % 60).padStart(2, "0")}`}
                      </span>
                      <span className="text-sm text-muted-foreground">{s.submittedAt && format.dateTime(s.submittedAt, { dateStyle: "short" })}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", s.status === "RETURNED" ? "bg-success/15 text-success" : "bg-brand text-white")}>
                        {s.status === "RETURNED" && s.feedback?.score != null ? `${s.feedback.score}/100` : ts(s.status)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <div className="grid h-fit gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-sans text-base">{t("materials")}</CardTitle>
            </CardHeader>
            <CardContent>
              <MaterialsEditor
                assignmentId={assignment.id}
                items={assignment.materials.map((m) => ({ id: m.id, mediaId: m.mediaFile.id, name: m.mediaFile.originalName ?? "", mime: m.mediaFile.mime }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-sans text-base">{t("settings")}</CardTitle>
            </CardHeader>
            <CardContent>
              <AssignmentForm levels={levels} assignment={{ ...assignment, skill: assignment.skill as "WRITING" | "SPEAKING" }} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LevelBadge } from "@/features/admin-shell/ui";
import { MaterialList } from "@/features/assignments/components/materials";
import { ReviewForm } from "@/features/assignments/components/review-form";
import { getSubmissionForReview } from "@/features/assignments/server";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/server/dal/guards";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Correction d'une copie : consigne, travail de l'étudiant (texte ou audio), note et commentaire. */
export default async function ReviewSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const s = await getSubmissionForReview(id);
  if (!s || s.status === "DRAFT") notFound();
  const t = await getTranslations("assignments.review");
  const format = await getFormatter();
  const a = s.assignment;

  return (
    <div className="space-y-6">
      <Link href="/admin/assignments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {t("back")}
      </Link>
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {a.level && <LevelBadge code={a.level.code} />} {a.title}
        </p>
        <h1 className="text-3xl font-medium">
          <Link href={`/admin/students/${s.user.id}`} className="hover:underline">
            {s.user.name}
          </Link>
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("meta", { version: s.version })}
          {s.submittedAt && ` · ${format.dateTime(s.submittedAt, { dateStyle: "long", timeStyle: "short" })}`}
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-sans text-base">{t("prompt")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-muted-foreground">{a.prompt}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between font-sans text-base">
                {t("work")}
                <span className="text-sm font-normal text-muted-foreground">
                  {a.skill === "WRITING"
                    ? t("words", { count: s.wordCount ?? 0, min: a.minWords ?? 0, max: a.maxWords ?? 0 })
                    : t("duration", { seconds: s.durationSec ?? 0 })}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {s.text && (
                <p lang="en" className="text-lg leading-relaxed whitespace-pre-wrap">
                  {s.text}
                </p>
              )}
              {s.audioFileId && <audio controls src={`/api/media/${s.audioFileId}`} className="w-full" />}
              {s.file && (
                <div className="mt-4 grid gap-3">
                  {s.file.mime.startsWith("image/") && (
                    // eslint-disable-next-line @next/next/no-img-element -- copie de l'étudiant, URL signée
                    <img src={`/api/media/${s.file.id}`} alt={s.file.originalName ?? ""} className="max-h-[600px] w-full rounded-lg border object-contain" />
                  )}
                  <MaterialList items={[{ mediaId: s.file.id, name: s.file.originalName ?? "", mime: s.file.mime }]} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="font-sans text-base">{s.feedback?.returnedAt ? t("editFeedback") : t("feedback")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewForm submissionId={s.id} initial={s.feedback ?? undefined} nextHref="/admin/assignments" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getStudentAssignment } from "@/features/assignments/server";
import { AssignmentWorkspace } from "@/features/assignments/components/workspace";
import { Link } from "@/i18n/navigation";
import { requireApprovedStudent } from "@/server/dal/guards";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Devoir de l'étudiant : 404 s'il n'est pas publié ou d'un autre niveau. */
export default async function StudentAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireApprovedStudent();
  const { id } = await params;
  const assignment = await getStudentAssignment(viewer.userId, id);
  if (!assignment) notFound();
  const t = await getTranslations("assignments.student");

  return (
    <div className="space-y-6">
      <Link href="/app/assignments" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {t("back")}
      </Link>
      <div>
        <p className="text-xs font-semibold tracking-[0.25em] text-brand-ink uppercase">
          {assignment.level?.code} · {t(`skills.${assignment.skill}`)}
        </p>
        <h1 className="mt-1 text-3xl font-medium sm:text-4xl">{assignment.title}</h1>
      </div>
      <AssignmentWorkspace
        assignment={{
          id: assignment.id,
          title: assignment.title,
          prompt: assignment.prompt,
          skill: assignment.skill as "WRITING" | "SPEAKING",
          levelCode: assignment.level?.code ?? "",
          minWords: assignment.minWords,
          maxWords: assignment.maxWords,
          maxDurationSec: assignment.maxDurationSec,
        }}
        submissions={assignment.submissions.map((s) => ({
          ...s,
          submittedAt: s.submittedAt?.toISOString() ?? null,
          feedback: s.feedback ? { ...s.feedback, returnedAt: s.feedback.returnedAt?.toISOString() ?? null } : null,
        }))}
      />
    </div>
  );
}

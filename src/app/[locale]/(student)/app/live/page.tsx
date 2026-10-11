import { Hand, MessageSquare, Smile, Video } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SessionList } from "@/features/live/components/session-list";
import { listStudentSessions, serverNow } from "@/features/live/server";
import { requireApprovedStudent } from "@/server/dal/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("live");
  return { title: t("title") };
}

/** Cours en direct du niveau de l'étudiant, avec accès à la salle virtuelle. */
export default async function StudentLivePage() {
  const viewer = await requireApprovedStudent();
  const t = await getTranslations("live");
  const sessions = await listStudentSessions(viewer.levelId);
  const features = [
    { icon: Video, label: t("features.video") },
    { icon: MessageSquare, label: t("features.chat") },
    { icon: Hand, label: t("features.hand") },
    { icon: Smile, label: t("features.reactions") },
  ];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-night p-7 text-night-foreground sm:p-10">
        <div className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full bg-brand/30 blur-3xl" aria-hidden />
        <div className="relative max-w-2xl">
          <p className="mb-2 text-xs font-semibold tracking-[0.3em] text-brand-soft uppercase">{t("eyebrow")}</p>
          <h1 className="text-3xl font-medium text-balance sm:text-4xl">{t("title")}</h1>
          <p className="mt-3 text-white/70">{t("subtitle")}</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm">
                <Icon className="size-4 text-brand-soft" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
          <p className="font-display text-xl">{t("emptyTitle")}</p>
          <p className="mt-1 text-muted-foreground">{t("emptyText")}</p>
        </div>
      ) : (
        <SessionList
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
          }))}
        />
      )}
    </div>
  );
}

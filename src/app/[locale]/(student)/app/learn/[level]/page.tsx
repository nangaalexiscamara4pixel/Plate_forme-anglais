import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LEVEL_THEME, type LevelCode } from "@/components/brand/levels";
import { Progress } from "@/components/ui/progress";
import { getAccessibleLevels, getLevelOverview, parseLevelParam } from "@/features/learn/queries";
import { levelHref, SKILL_ICON, skillHref } from "@/features/learn/skills";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { requireApprovedStudent } from "@/server/dal/guards";

export async function generateMetadata({ params }: { params: Promise<{ level: string }> }): Promise<Metadata> {
  const { level } = await params;
  return { title: level.toUpperCase() };
}

export default async function LevelPage({ params }: { params: Promise<{ level: string }> }) {
  const viewer = await requireApprovedStudent();
  const code = parseLevelParam((await params).level);
  if (!code) notFound();
  const [overview, { levels }] = await Promise.all([getLevelOverview(viewer.userId, code), getAccessibleLevels(viewer.userId)]);
  if (!overview) notFound();

  const t = await getTranslations("learn");
  const tl = await getTranslations("levels");
  const ts = await getTranslations("skills");
  const theme = LEVEL_THEME[code as LevelCode];
  const LevelIcon = theme.icon;

  return (
    <div className="space-y-10">
      <header className={cn("relative overflow-hidden rounded-2xl p-6 text-white sm:p-10", theme.bg)}>
        <LevelIcon className="absolute -right-6 -bottom-8 size-48 opacity-15" aria-hidden />
        <p className="text-sm font-semibold tracking-[0.3em] uppercase opacity-80">{t("level")}</p>
        <h1 className="mt-1 text-4xl font-medium sm:text-5xl">
          {code} · {tl(`${code}.name`)}
        </h1>
        <p className="mt-2 max-w-xl opacity-90">{tl(`${code}.tagline`)}</p>
        {!overview.isCurrent && <p className="mt-4 inline-block rounded-full bg-white/20 px-3 py-1 text-sm">{t("reviewMode")}</p>}
      </header>

      {levels.length > 1 && (
        <nav aria-label={t("levelSwitcher")} className="flex flex-wrap gap-2">
          {levels.map((l) => (
            <Link
              key={l.id}
              href={levelHref(l.code)}
              aria-current={l.code === code ? "page" : undefined}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors hover:bg-accent",
                l.code === code && "border-primary bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {l.code} · {tl(`${l.code}.name`)}
            </Link>
          ))}
        </nav>
      )}

      <section className="grid gap-4 sm:grid-cols-2" aria-label={t("skillsTitle")}>
        {overview.modules.map((m) => {
          const Icon = SKILL_ICON[m.skill];
          const pct = m.lessonCount ? Math.round((m.completedCount / m.lessonCount) * 100) : 0;
          const done = m.lessonCount > 0 && m.completedCount === m.lessonCount;
          return (
            <Link
              key={m.id}
              href={skillHref(code, m.skill)}
              className="group grid gap-4 rounded-2xl border bg-card p-6 transition-shadow hover:shadow-lg focus-visible:ring-2"
            >
              <div className="flex items-start justify-between">
                <span className={cn("flex size-12 items-center justify-center rounded-xl", theme.soft)}>
                  <Icon className={cn("size-6", theme.text)} aria-hidden />
                </span>
                {done ? (
                  <CheckCircle2 className="size-6 text-success" aria-label={t("completed")} />
                ) : (
                  <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden />
                )}
              </div>
              <div>
                <h2 className="text-2xl">{ts(m.skill)}</h2>
                <p className="text-sm text-muted-foreground">{m.description}</p>
              </div>
              <div className="grid gap-1.5">
                <Progress value={pct} aria-label={t("progressLabel", { skill: ts(m.skill) })} />
                <p className="text-xs text-muted-foreground">
                  {m.lessonCount === 0 ? t("noLessonsYet") : t("lessonsProgress", { done: m.completedCount, total: m.lessonCount })}
                </p>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

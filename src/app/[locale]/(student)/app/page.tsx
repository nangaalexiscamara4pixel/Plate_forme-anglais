import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LEVEL_THEME, type LevelCode } from "@/components/brand/levels";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getAccessibleLevels, getLevelOverview } from "@/features/learn/queries";
import { levelHref, SKILL_ICON, skillHref } from "@/features/learn/skills";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { requireApprovedStudent } from "@/server/dal/guards";

// Tableau de bord provisoire : la version complète (prochaine session, série, devoirs…) arrive en phase 6.
export default async function StudentHomePage() {
  const viewer = await requireApprovedStudent();
  const t = await getTranslations("app");
  const tl = await getTranslations("levels");
  const ts = await getTranslations("skills");
  const { current } = await getAccessibleLevels(viewer.userId);
  const overview = current ? await getLevelOverview(viewer.userId, current.code) : null;
  const theme = current ? LEVEL_THEME[current.code as LevelCode] : null;
  const LevelIcon = theme?.icon;

  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <h1 className="text-3xl font-medium sm:text-4xl">{t("welcome", { name: viewer.name.split(" ")[0] ?? viewer.name })}</h1>
        <p className="text-muted-foreground">{t("welcomeSubtitle")}</p>
      </section>

      {current && theme && LevelIcon && (
        <Card className={cn("overflow-hidden ring-1", theme.ring)}>
          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
            <span className={cn("flex size-14 items-center justify-center rounded-xl text-white", theme.bg)}>
              <LevelIcon className="size-7" aria-hidden />
            </span>
            <div className="flex-1">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("yourLevel")}</p>
              <p className="font-display text-2xl">
                {current.code} – {tl(`${current.code}.name`)}
              </p>
              <p className="text-sm text-muted-foreground">{tl(`${current.code}.tagline`)}</p>
            </div>
            <Button asChild>
              <Link href={levelHref(current.code)}>
                {t("goToCourses")} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {overview && current && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {overview.modules.map((m) => {
            const Icon = SKILL_ICON[m.skill];
            const pct = m.lessonCount ? Math.round((m.completedCount / m.lessonCount) * 100) : 0;
            return (
              <Link key={m.id} href={skillHref(current.code, m.skill)} className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
                <Icon className={cn("mb-3 size-6", theme?.text)} aria-hidden />
                <p className="font-display text-xl">{ts(m.skill)}</p>
                <Progress value={pct} className="mt-3" aria-label={ts(m.skill)} />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {m.completedCount}/{m.lessonCount}
                </p>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}

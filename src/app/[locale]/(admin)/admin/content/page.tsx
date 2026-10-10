import { Clapperboard } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LEVEL_THEME, type LevelCode } from "@/components/brand/levels";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/admin-shell/ui";
import { getContentOverview } from "@/features/content/admin-queries";
import { SKILL_ICON } from "@/features/learn/skills";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/dal/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.content");
  return { title: t("title") };
}

export default async function ContentOverviewPage() {
  await requireAdmin();
  const t = await getTranslations("admin.content");
  const tl = await getTranslations("levels");
  const ts = await getTranslations("skills");
  const levels = await getContentOverview();

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/media">
              <Clapperboard className="size-4" aria-hidden /> {t("mediaLibrary")}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6">
        {levels.map((level) => {
          const theme = LEVEL_THEME[level.code as LevelCode];
          const Icon = theme.icon;
          return (
            <section key={level.id} className="rounded-2xl border bg-card p-5" aria-labelledby={`lvl-${level.code}`}>
              <h2 id={`lvl-${level.code}`} className="mb-4 flex items-center gap-3 text-xl">
                <span className={cn("flex size-9 items-center justify-center rounded-lg text-white", theme.bg)}>
                  <Icon className="size-5" aria-hidden />
                </span>
                {level.code} · {tl(`${level.code}.name`)}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {level.modules.map((m) => {
                  const SkillIcon = SKILL_ICON[m.skill];
                  return (
                    <Link
                      key={m.id}
                      href={`/admin/content/${level.code.toLowerCase()}/${m.skill.toLowerCase()}`}
                      className="rounded-xl border p-4 transition-colors hover:bg-accent/60"
                    >
                      <p className="flex items-center gap-2 font-medium">
                        <SkillIcon className={cn("size-4", theme.text)} aria-hidden /> {ts(m.skill)}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t("moduleStats", { units: m.units, live: m.liveUnits, lessons: m.lessons })}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

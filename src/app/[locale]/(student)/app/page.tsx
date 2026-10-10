import { BookOpen, Ear, Mic, PenLine } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LEVEL_THEME, type LevelCode } from "@/components/brand/levels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { db } from "@/server/db";
import { requireApprovedStudent } from "@/server/dal/guards";

const SKILLS = [
  { code: "READING", icon: BookOpen },
  { code: "SPEAKING", icon: Mic },
  { code: "WRITING", icon: PenLine },
  { code: "LISTENING", icon: Ear },
] as const;

export default async function StudentHomePage() {
  const viewer = await requireApprovedStudent();
  const t = await getTranslations("app");
  const tl = await getTranslations("levels");
  const ts = await getTranslations("skills");
  const level = viewer.levelId ? await db.level.findUnique({ where: { id: viewer.levelId } }) : null;
  const theme = level ? LEVEL_THEME[level.code as LevelCode] : null;
  const LevelIcon = theme?.icon;

  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <h1 className="text-3xl font-medium sm:text-4xl">{t("welcome", { name: viewer.name.split(" ")[0] ?? viewer.name })}</h1>
        <p className="text-muted-foreground">{t("welcomeSubtitle")}</p>
      </section>

      {level && theme && LevelIcon && (
        <Card className={cn("overflow-hidden ring-1", theme.ring)}>
          <CardContent className="flex items-center gap-5 p-6">
            <span className={cn("flex size-14 items-center justify-center rounded-xl text-white", theme.bg)}>
              <LevelIcon className="size-7" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("yourLevel")}</p>
              <p className="font-display text-2xl">
                {level.code} – {tl(`${level.code}.name`)}
              </p>
              <p className="text-sm text-muted-foreground">{tl(`${level.code}.tagline`)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SKILLS.map(({ code, icon: Icon }) => (
          <Card key={code} className="transition-shadow hover:shadow-md">
            <CardContent className="space-y-3 p-6">
              <Icon className={cn("size-6", theme?.text)} aria-hidden />
              <p className="font-display text-xl">{ts(code)}</p>
              <Badge variant="secondary">{t("comingSoon")}</Badge>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

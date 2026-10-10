import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/features/admin-shell/ui";
import { getModuleTree } from "@/features/content/admin-queries";
import { ModuleEditor } from "@/features/content/components/module-editor";
import { parseLevelParam, parseSkillParam } from "@/features/learn/queries";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/server/dal/guards";

export const metadata: Metadata = { title: "Module" };

export default async function ModulePage({ params }: { params: Promise<{ level: string; skill: string }> }) {
  await requireAdmin();
  const p = await params;
  const code = parseLevelParam(p.level);
  const skill = parseSkillParam(p.skill);
  if (!code || !skill) notFound();
  const tree = await getModuleTree(code, skill);
  if (!tree) notFound();
  const t = await getTranslations("admin.content");
  const tl = await getTranslations("levels");
  const ts = await getTranslations("skills");

  return (
    <>
      <Link href="/admin/content" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {t("title")}
      </Link>
      <PageHeader title={`${code} ${tl(`${code}.name`)} · ${ts(skill)}`} description={t("moduleHelp")} />
      <ModuleEditor
        moduleId={tree.module.id}
        units={tree.module.units.map((u) => ({
          id: u.id,
          title: u.title,
          summary: u.summary,
          status: u.status,
          publishAt: u.publishAt,
          lessons: u.lessons.map((l) => ({ id: l.id, title: l.title, type: l.type, status: l.status, publishAt: l.publishAt, blocks: l._count.blocks })),
        }))}
      />
    </>
  );
}

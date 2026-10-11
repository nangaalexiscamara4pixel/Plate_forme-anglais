import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, LevelBadge, PageHeader } from "@/features/admin-shell/ui";
import { PublicationBadge } from "@/features/content/components/publication";
import { ExerciseForm } from "@/features/exercises/components/exercise-form";
import { listAdminExercises } from "@/features/exercises/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/dal/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("exercises.admin");
  return { title: t("pageTitle") };
}

/** Back-office : liste des exercices et création. */
export default async function AdminExercisesPage() {
  await requireAdmin();
  const t = await getTranslations("exercises.admin");
  const [exercises, levels] = await Promise.all([listAdminExercises(), db.level.findMany({ orderBy: { order: "asc" }, select: { id: true, code: true, name: true } })]);

  return (
    <div>
      <PageHeader title={t("pageTitle")} description={t("pageSubtitle")} />
      <div className="grid gap-8 xl:grid-cols-[1fr_24rem]">
        <section className="order-2 xl:order-1">
          {exercises.length === 0 ? (
            <EmptyState icon={<ClipboardList className="size-6" aria-hidden />} title={t("emptyTitle")} body={t("emptyText")} />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("title")}</TableHead>
                    <TableHead>{t("level")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("questions")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("attempts")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exercises.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Link href={`/admin/exercises/${e.id}`} className="font-medium hover:underline">
                          {e.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">{t(`kinds.${e.kind}`)}</p>
                      </TableCell>
                      <TableCell>{e.level && <LevelBadge code={e.level.code} />}</TableCell>
                      <TableCell className="hidden tabular-nums md:table-cell">{e._count.questions}</TableCell>
                      <TableCell className="hidden tabular-nums md:table-cell">{e._count.attempts}</TableCell>
                      <TableCell>
                        <PublicationBadge status={e.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </section>
        <Card className="order-1 h-fit xl:order-2">
          <CardHeader>
            <CardTitle className="font-sans text-base">{t("newExercise")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ExerciseForm levels={levels} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

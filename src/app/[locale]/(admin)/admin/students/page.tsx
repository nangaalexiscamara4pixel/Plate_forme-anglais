import { Download, Users } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, LevelBadge, PageHeader, Pagination, qs, StatusBadge } from "@/features/admin-shell/ui";
import { StudentFiltersBar } from "@/features/students/components/student-filters";
import { StudentRowActions } from "@/features/students/components/row-actions";
import { parseStudentFilters } from "@/features/students/filters";
import { listStudents } from "@/features/students/queries";
import { Link } from "@/i18n/navigation";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/dal/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.students");
  return { title: t("title") };
}

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const admin = await requireAdmin();
  const filters = parseStudentFilters(await searchParams);
  const t = await getTranslations("admin.students");
  const format = await getFormatter();
  const [{ rows, total, pageCount }, levels] = await Promise.all([
    listStudents(filters),
    db.level.findMany({ orderBy: { order: "asc" }, select: { code: true, name: true } }),
  ]);
  const base = { q: filters.q, status: filters.status, level: filters.level, sort: filters.sort === "recent" ? undefined : filters.sort };
  const date = (d: Date | null) =>
    d ? format.dateTime(d, { dateStyle: "medium", timeZone: admin.timezone }) : t("never");

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("count", { count: total })}
        actions={
          <Button asChild variant="outline">
            {/* Lien direct (pas de prefetch) : déclenche le téléchargement, journalisé côté serveur */}
            <a href={`/api/admin/students/export${qs({ q: filters.q, status: filters.status, level: filters.level })}`} download>
              <Download className="size-4" aria-hidden /> {t("exportCsv")}
            </a>
          </Button>
        }
      />
      <StudentFiltersBar filters={filters} levels={levels} />

      {rows.length === 0 ? (
        <EmptyState icon={<Users className="size-5" aria-hidden />} title={t("empty")} body={t("emptyBody")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.student")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.level")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("columns.country")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("columns.registered")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("columns.lastLogin")}</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">{t("columns.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/admin/students/${s.id}`} className="grid rounded-sm hover:underline">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.email}</span>
                    </Link>
                    {!s.emailVerified && <span className="text-xs text-warning">{t("unverified")}</span>}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} />
                  </TableCell>
                  <TableCell>{s.currentLevel ? <LevelBadge code={s.currentLevel.code} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="hidden md:table-cell">{s.profile?.country ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{date(s.createdAt)}</TableCell>
                  <TableCell className="hidden lg:table-cell">{date(s.lastLoginAt)}</TableCell>
                  <TableCell>
                    <StudentRowActions studentId={s.id} name={s.name} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination
        page={filters.page}
        pageCount={pageCount}
        hrefFor={(page) => `/admin/students${qs({ ...base, page: page > 1 ? page : undefined })}`}
      />
    </>
  );
}

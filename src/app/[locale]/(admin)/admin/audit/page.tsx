import { ScrollText, X } from "lucide-react";
import { actionKey } from "@/features/audit/format";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, Pagination, qs } from "@/features/admin-shell/ui";
import { auditDetails } from "@/features/audit/format";
import { listAuditLogs, parseAuditFilters } from "@/features/audit/queries";
import { describeUserAgent } from "@/lib/user-agent";
import { Link } from "@/i18n/navigation";
import { AUDIT_ACTIONS } from "@/server/audit";
import { requireAdmin } from "@/server/dal/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.audit");
  return { title: t("title") };
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const admin = await requireAdmin();
  const filters = parseAuditFilters(await searchParams);
  const t = await getTranslations("admin.audit");
  const ta = await getTranslations("admin.auditActions");
  const format = await getFormatter();
  const { rows, total, pageCount, admins } = await listAuditLogs(filters);
  const active = Boolean(filters.action || filters.actor || filters.target || filters.from || filters.to);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle", { count: total })} />

      <form method="get" className="mb-6 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
        <div className="grid gap-1.5">
          <Label htmlFor="action">{t("action")}</Label>
          <select id="action" name="action" defaultValue={filters.action ?? ""} className={selectClass}>
            <option value="">{t("allActions")}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {ta(actionKey(a))}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="actor">{t("actor")}</Label>
          <select id="actor" name="actor" defaultValue={filters.actor ?? ""} className={selectClass}>
            <option value="">{t("allActors")}</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="from">{t("from")}</Label>
          <Input id="from" name="from" type="date" defaultValue={filters.from} className="h-9" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to">{t("to")}</Label>
          <Input id="to" name="to" type="date" defaultValue={filters.to} className="h-9" />
        </div>
        {filters.target && <input type="hidden" name="target" value={filters.target} />}
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm" className="h-9">
            {t("filter")}
          </Button>
          {active && (
            <Button asChild variant="ghost" size="sm" className="h-9">
              <Link href="/admin/audit">
                <X className="size-4" aria-hidden /> {t("reset")}
              </Link>
            </Button>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={<ScrollText className="size-5" aria-hidden />} title={t("empty")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("actor")}</TableHead>
                <TableHead>{t("action")}</TableHead>
                <TableHead>{t("target")}</TableHead>
                <TableHead className="hidden xl:table-cell">{t("origin")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {format.dateTime(r.createdAt, { dateStyle: "short", timeStyle: "medium", timeZone: admin.timezone })}
                  </TableCell>
                  <TableCell>{r.actor?.name ?? t("system")}</TableCell>
                  <TableCell>
                    <span className="font-medium">{ta.has(actionKey(r.action)) ? ta(actionKey(r.action)) : r.action}</span>
                    {auditDetails(r.metadata) && <span className="block text-xs text-muted-foreground">{auditDetails(r.metadata)}</span>}
                  </TableCell>
                  <TableCell>
                    {r.target ? (
                      <Link href={`/admin/students/${r.target.id}`} className="hover:underline">
                        {r.target.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                    {r.ip ?? "—"} · {describeUserAgent(r.userAgent).label}
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
        hrefFor={(page) =>
          `/admin/audit${qs({ action: filters.action, actor: filters.actor, target: filters.target, from: filters.from, to: filters.to, page: page > 1 ? page : undefined })}`
        }
      />
    </>
  );
}

"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import type { StudentFilters } from "../filters";

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * Barre de filtres : un simple formulaire GET (fonctionne sans JavaScript).
 * Avec JavaScript, un changement de liste déroulante soumet immédiatement.
 */
export function StudentFiltersBar({ filters, levels }: { filters: StudentFilters; levels: { code: string; name: string }[] }) {
  const t = useTranslations("admin.students");
  const ts = useTranslations("admin.stats");
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();
  const active = Boolean(filters.q || filters.status || filters.level || filters.sort !== "recent");

  return (
    <form ref={form} method="get" role="search" className="mb-6 flex flex-wrap items-end gap-3">
      <div className="relative min-w-56 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          name="q"
          type="search"
          defaultValue={filters.q}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
          className="pl-9"
          maxLength={100}
        />
      </div>
      <select name="status" defaultValue={filters.status ?? ""} onChange={submit} className={selectClass} aria-label={t("statusFilter")}>
        <option value="">{t("allStatuses")}</option>
        {(["PENDING", "APPROVED", "SUSPENDED", "REJECTED"] as const).map((s) => (
          <option key={s} value={s}>
            {ts(s)}
          </option>
        ))}
      </select>
      <select name="level" defaultValue={filters.level ?? ""} onChange={submit} className={selectClass} aria-label={t("levelFilter")}>
        <option value="">{t("allLevels")}</option>
        {levels.map((l) => (
          <option key={l.code} value={l.code}>
            {l.code} – {l.name}
          </option>
        ))}
      </select>
      <select name="sort" defaultValue={filters.sort} onChange={submit} className={selectClass} aria-label={t("sortLabel")}>
        {(["recent", "oldest", "name", "lastLogin"] as const).map((s) => (
          <option key={s} value={s}>
            {t(`sort.${s}`)}
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary" size="sm" className="h-9">
        {t("apply")}
      </Button>
      {active && (
        <Button asChild variant="ghost" size="sm" className="h-9">
          <Link href="/admin/students">
            <X className="size-4" aria-hidden /> {t("reset")}
          </Link>
        </Button>
      )}
    </form>
  );
}

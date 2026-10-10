"use client";

import { Eye, MoreHorizontal, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { startImpersonationAction } from "@/features/impersonation/actions";
import { Link } from "@/i18n/navigation";

/** Menu d'actions rapides d'une ligne de la liste des étudiants. */
export function StudentRowActions({ studentId, name }: { studentId: string; name: string }) {
  const t = useTranslations("admin.students");
  const te = useTranslations("errors");
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("actionsFor", { name })} disabled={pending}>
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/admin/students/${studentId}`}>
            <UserRound className="size-4" aria-hidden /> {t("viewAccount")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            startTransition(async () => {
              const res = await startImpersonationAction(null, { studentId });
              if (res && !res.ok) toast.error(te.has(res.error) ? te(res.error) : te("generic"));
            })
          }
        >
          <Eye className="size-4" aria-hidden /> {t("viewAs")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

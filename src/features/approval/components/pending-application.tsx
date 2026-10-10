"use client";

import { Check, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { changeStatusAction } from "../actions";

type Props = {
  student: { id: string; name: string; email: string; meta: string };
  levels: { id: string; code: string; name: string }[];
};

export function PendingApplication({ student, levels }: Props) {
  const t = useTranslations("admin");
  const te = useTranslations("errors");
  const [levelId, setLevelId] = useState<string>("");
  const [state, action, pending] = useActionState(changeStatusAction, null);

  useEffect(() => {
    if (state && !state.ok) toast.error(te.has(state.error ?? "") ? te(state.error ?? "generic") : te("generic"));
  }, [state, te]);

  return (
    <li className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">{student.name}</p>
        <p className="truncate text-sm text-muted-foreground">{student.email}</p>
        <p className="text-xs text-muted-foreground">{student.meta}</p>
      </div>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="studentId" value={student.id} />
        <input type="hidden" name="levelId" value={levelId} />
        <Select value={levelId} onValueChange={setLevelId}>
          <SelectTrigger className="w-44" aria-label={t("chooseLevel")}>
            <SelectValue placeholder={t("chooseLevel")} />
          </SelectTrigger>
          <SelectContent>
            {levels.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.code} – {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" name="status" value="APPROVED" disabled={pending || !levelId}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          {t("approve")}
        </Button>
        <Button type="submit" name="status" value="REJECTED" variant="outline" disabled={pending}>
          <X className="size-4" aria-hidden />
          {t("reject")}
        </Button>
      </form>
    </li>
  );
}

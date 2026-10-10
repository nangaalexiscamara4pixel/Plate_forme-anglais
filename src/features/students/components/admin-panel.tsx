"use client";

import { Ban, Check, Eye, KeyRound, LogOut, RotateCcw, TrendingUp, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { startImpersonationAction } from "@/features/impersonation/actions";
import {
  changeLevelAction,
  revokeAllSessionsAction,
  sendPasswordResetAction,
  setStudentStatusAction,
} from "../actions";
import { ConfirmAction } from "./confirm-action";

type Level = { id: string; code: string; name: string };

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

function LevelSelect({ levels, exclude, defaultValue }: { levels: Level[]; exclude?: string | null; defaultValue?: string }) {
  const t = useTranslations("admin.student");
  return (
    <div className="grid gap-2">
      <Label htmlFor="levelId">{t("levelLabel")}</Label>
      <select id="levelId" name="levelId" required className={selectClass} defaultValue={defaultValue ?? ""}>
        <option value="" disabled>
          {t("chooseLevel")}
        </option>
        {levels
          .filter((l) => l.id !== exclude)
          .map((l) => (
            <option key={l.id} value={l.id}>
              {l.code} – {l.name}
            </option>
          ))}
      </select>
    </div>
  );
}

/** Panneau « Gestion du compte » de la fiche étudiant. */
export function StudentAdminPanel({
  student,
  levels,
}: {
  student: { id: string; name: string; status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED"; currentLevelId: string | null };
  levels: Level[];
}) {
  const t = useTranslations("admin.student");
  const te = useTranslations("errors");
  const [mode, setMode] = useState<"promote" | "reassign">("promote");
  const [impersonating, startImpersonation] = useTransition();
  const id = { studentId: student.id };
  const nextLevel = levels[levels.findIndex((l) => l.id === student.currentLevelId) + 1];

  return (
    <div className="grid gap-3">
      {(student.status === "PENDING" || student.status === "REJECTED") && (
        <ConfirmAction
          action={setStudentStatusAction}
          fields={{ ...id, status: "APPROVED" }}
          trigger={
            <Button className="w-full justify-start">
              <Check className="size-4" aria-hidden /> {t("approve")}
            </Button>
          }
          title={t("approveTitle", { name: student.name })}
          description={t("approveBody")}
          confirmLabel={t("approve")}
          successMessage={t("approved")}
        >
          <LevelSelect levels={levels} defaultValue={student.currentLevelId ?? undefined} />
        </ConfirmAction>
      )}

      {student.status === "PENDING" && (
        <ConfirmAction
          action={setStudentStatusAction}
          fields={{ ...id, status: "REJECTED" }}
          trigger={
            <Button variant="outline" className="w-full justify-start">
              <X className="size-4" aria-hidden /> {t("reject")}
            </Button>
          }
          title={t("rejectTitle", { name: student.name })}
          description={t("rejectBody")}
          confirmLabel={t("reject")}
          successMessage={t("rejected")}
          destructive
          withReason
        />
      )}

      {student.status === "APPROVED" && (
        <ConfirmAction
          action={changeLevelAction}
          fields={{ ...id, mode }}
          trigger={
            <Button variant="outline" className="w-full justify-start">
              <TrendingUp className="size-4" aria-hidden /> {t("changeLevel")}
            </Button>
          }
          title={t("changeLevelTitle")}
          description={mode === "promote" ? t("promoteBody") : t("reassignBody")}
          confirmLabel={t("changeLevel")}
          successMessage={t("levelChanged")}
        >
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t("modeLabel")}</legend>
            {(["promote", "reassign"] as const).map((m) => (
              <label key={m} className="flex items-start gap-2 text-sm">
                <input type="radio" name="modeChoice" value={m} checked={mode === m} onChange={() => setMode(m)} className="mt-1" />
                <span>
                  <span className="font-medium">{t(`mode.${m}`)}</span>
                  <span className="block text-muted-foreground">{t(`modeHint.${m}`)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <LevelSelect
            key={mode}
            levels={levels}
            exclude={student.currentLevelId}
            defaultValue={mode === "promote" ? nextLevel?.id : undefined}
          />
        </ConfirmAction>
      )}

      {student.status === "APPROVED" && (
        <ConfirmAction
          action={setStudentStatusAction}
          fields={{ ...id, status: "SUSPENDED" }}
          trigger={
            <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive">
              <Ban className="size-4" aria-hidden /> {t("suspend")}
            </Button>
          }
          title={t("suspendTitle", { name: student.name })}
          description={t("suspendBody")}
          confirmLabel={t("suspend")}
          successMessage={t("suspended")}
          destructive
          withReason
        />
      )}

      {student.status === "SUSPENDED" && (
        <ConfirmAction
          action={setStudentStatusAction}
          fields={{ ...id, status: "APPROVED" }}
          trigger={
            <Button className="w-full justify-start">
              <RotateCcw className="size-4" aria-hidden /> {t("reactivate")}
            </Button>
          }
          title={t("reactivateTitle", { name: student.name })}
          description={t("reactivateBody")}
          confirmLabel={t("reactivate")}
          successMessage={t("reactivated")}
        />
      )}

      <hr className="my-1" />

      <Button
        variant="outline"
        className="w-full justify-start"
        disabled={impersonating}
        onClick={() =>
          startImpersonation(async () => {
            const res = await startImpersonationAction(null, id);
            if (res && !res.ok) toast.error(te.has(res.error) ? te(res.error) : te("generic"));
          })
        }
      >
        <Eye className="size-4" aria-hidden /> {t("viewAs")}
      </Button>

      <ConfirmAction
        action={sendPasswordResetAction}
        fields={id}
        trigger={
          <Button variant="outline" className="w-full justify-start">
            <KeyRound className="size-4" aria-hidden /> {t("resetPassword")}
          </Button>
        }
        title={t("resetPasswordTitle")}
        description={t("resetPasswordBody")}
        confirmLabel={t("sendLink")}
        successMessage={t("resetSent")}
      />

      <ConfirmAction
        action={revokeAllSessionsAction}
        fields={id}
        trigger={
          <Button variant="outline" className="w-full justify-start">
            <LogOut className="size-4" aria-hidden /> {t("revokeAll")}
          </Button>
        }
        title={t("revokeAllTitle")}
        description={t("revokeAllBody", { name: student.name })}
        confirmLabel={t("revokeAll")}
        successMessage={t("revoked")}
        destructive
      />
    </div>
  );
}

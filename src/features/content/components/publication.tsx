"use client";

import { Archive, CheckCircle2, Clock, PencilLine } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type PubStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

const STYLE: Record<PubStatus, { icon: typeof Clock; cls: string }> = {
  DRAFT: { icon: PencilLine, cls: "border-border bg-muted text-muted-foreground" },
  SCHEDULED: { icon: Clock, cls: "border-warning/40 bg-warning/10 text-foreground [&_svg]:text-warning" },
  PUBLISHED: { icon: CheckCircle2, cls: "border-success/40 bg-success/10 text-foreground [&_svg]:text-success" },
  ARCHIVED: { icon: Archive, cls: "border-border bg-muted text-muted-foreground" },
};

/** Statut de publication : icône + libellé ; pour un contenu programmé, la date. */
export function PublicationBadge({ status, publishAt }: { status: PubStatus; publishAt?: Date | string | null }) {
  const t = useTranslations("admin.content.status");
  const format = useFormatter();
  const { icon: Icon, cls } = STYLE[status];
  const live = status === "SCHEDULED" && publishAt && new Date(publishAt) <= new Date();
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", cls)}>
      <Icon className="size-3" aria-hidden />
      {live ? t("PUBLISHED") : t(status)}
      {status === "SCHEDULED" && publishAt && !live && ` · ${format.dateTime(new Date(publishAt), { dateStyle: "short", timeStyle: "short" })}`}
    </span>
  );
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Champs de publication. La date est saisie dans le fuseau du navigateur de l'administrateur
 * et envoyée en ISO (UTC) dans un champ caché.
 */
export function PublicationFields({ status, publishAt }: { status: PubStatus; publishAt?: Date | string | null }) {
  const t = useTranslations("admin.content");
  const [current, setCurrent] = useState<PubStatus>(status);
  const [local, setLocal] = useState(publishAt ? toLocalInput(new Date(publishAt)) : "");
  const iso = local ? new Date(local).toISOString() : "";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="status">{t("statusLabel")}</Label>
        <select
          id="status"
          name="status"
          value={current}
          onChange={(e) => setCurrent(e.target.value as PubStatus)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {(["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
      </div>
      {current === "SCHEDULED" && (
        <div className="grid gap-2">
          <Label htmlFor="publishAtLocal">{t("publishAt")}</Label>
          <input
            id="publishAtLocal"
            type="datetime-local"
            required
            value={local}
            min={toLocalInput(new Date())}
            onChange={(e) => setLocal(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
      )}
      <input type="hidden" name="publishAt" value={current === "SCHEDULED" ? iso : ""} />
    </div>
  );
}

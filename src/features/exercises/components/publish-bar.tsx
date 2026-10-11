"use client";

import { Archive, Eye, EyeOff, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PublicationBadge, type PubStatus } from "@/features/content/components/publication";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/server/actions";

type StatusAction = (prev: null, input: { id: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) => Promise<ActionResult>;
type DeleteAction = (prev: null, input: { id: string }) => Promise<ActionResult>;

/** Publication d'un exercice ou d'un devoir : publier, repasser en brouillon, archiver, supprimer. */
export function PublishBar({
  id,
  status,
  setStatus,
  remove,
  afterDelete,
  confirmDelete,
}: {
  id: string;
  status: PubStatus;
  setStatus: StatusAction;
  remove: DeleteAction;
  afterDelete: string;
  confirmDelete: string;
}) {
  const t = useTranslations("exercises.publish");
  const te = useTranslations("errors");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const change = async (next: "DRAFT" | "PUBLISHED" | "ARCHIVED") => {
    setBusy(true);
    const res = await setStatus(null, { id, status: next });
    setBusy(false);
    if (res.ok) {
      toast.success(t(`done.${next}`));
      router.refresh();
    } else toast.error(te(res.error));
  };
  const destroy = async () => {
    if (!window.confirm(confirmDelete)) return;
    setBusy(true);
    const res = await remove(null, { id });
    setBusy(false);
    if (res.ok) {
      toast.success(t("deleted"));
      router.push(afterDelete);
    } else toast.error(te(res.error));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PublicationBadge status={status} />
      {status === "PUBLISHED" ? (
        <Button variant="outline" size="sm" onClick={() => change("DRAFT")} disabled={busy}>
          <EyeOff className="size-4" aria-hidden /> {t("unpublish")}
        </Button>
      ) : (
        <Button size="sm" onClick={() => change("PUBLISHED")} disabled={busy} className="bg-success text-white hover:bg-success/90">
          <Eye className="size-4" aria-hidden /> {t("publish")}
        </Button>
      )}
      {status !== "ARCHIVED" && (
        <Button variant="ghost" size="sm" onClick={() => change("ARCHIVED")} disabled={busy}>
          <Archive className="size-4" aria-hidden /> {t("archive")}
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={destroy} disabled={busy} className="text-destructive hover:text-destructive">
        <Trash2 className="size-4" aria-hidden /> {t("delete")}
      </Button>
    </div>
  );
}

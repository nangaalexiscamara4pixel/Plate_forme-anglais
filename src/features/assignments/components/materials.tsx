"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { FileDrop, FileIcon } from "@/components/file-drop";
import { Button } from "@/components/ui/button";
import { adminAutoUploader } from "@/features/content/components/use-upload";
import { useRouter } from "@/i18n/navigation";
import { ACCEPT } from "@/lib/files";
import { addAssignmentMaterialAction, removeAssignmentMaterialAction } from "../actions";

export type Material = { id?: string; mediaId: string; name: string; mime: string };

/** Liste des documents de la consigne (ouverture dans un nouvel onglet). */
export function MaterialList({ items, onRemove }: { items: Material[]; onRemove?: (m: Material) => void }) {
  const t = useTranslations("files");
  if (items.length === 0) return null;
  return (
    <ul className="grid gap-2">
      {items.map((m) => (
        <li key={m.mediaId} className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
          <FileIcon mime={m.mime} className="size-6" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.name || t("file")}</span>
          <a href={`/api/media/${m.mediaId}`} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-ink hover:underline">
            {t("open")}
          </a>
          {onRemove && (
            <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(m)} aria-label={t("remove")} className="text-destructive hover:text-destructive">
              <Trash2 className="size-4" aria-hidden />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Back-office : ajout et retrait des documents joints à un devoir. */
export function MaterialsEditor({ assignmentId, items }: { assignmentId: string; items: Material[] }) {
  const t = useTranslations("assignments.admin");
  const te = useTranslations("errors");
  const router = useRouter();
  const [key, setKey] = useState(0);

  const add = async (mediaId: string) => {
    const res = await addAssignmentMaterialAction(null, { assignmentId, mediaId });
    if (!res.ok) return toast.error(te(res.error));
    toast.success(t("materialAdded"));
    setKey((k) => k + 1); // zone d'ajout remise à zéro pour le fichier suivant
    router.refresh();
  };
  const remove = async (m: Material) => {
    if (!m.id || !window.confirm(t("materialConfirmRemove", { name: m.name }))) return;
    const res = await removeAssignmentMaterialAction(null, { assignmentId, materialId: m.id });
    if (!res.ok) return toast.error(te(res.error));
    router.refresh();
  };

  return (
    <div className="grid gap-3">
      <MaterialList items={items} onRemove={remove} />
      <FileDrop key={key} uploader={adminAutoUploader} accept={`${ACCEPT.documentOrImage},${ACCEPT.audio}`} hint={t("materialHint")} value={null} onChange={(f) => f && add(f.id)} />
    </div>
  );
}

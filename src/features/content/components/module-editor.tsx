"use client";

import { FileText, MonitorPlay, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/features/students/components/confirm-action";
import { Link } from "@/i18n/navigation";
import {
  createLessonAction,
  createUnitAction,
  deleteLessonAction,
  deleteUnitAction,
  reorderAction,
  updateUnitAction,
} from "../actions";
import { PublicationBadge, PublicationFields, type PubStatus } from "./publication";
import { SortableList } from "./sortable-list";

type LessonRow = { id: string; title: string; type: "TEXT" | "VIDEO" | "MIXED"; status: PubStatus; publishAt: Date | null; blocks: number };
type UnitRow = { id: string; title: string; summary: string | null; status: PubStatus; publishAt: Date | null; lessons: LessonRow[] };

const TYPE_ICON = { TEXT: FileText, VIDEO: MonitorPlay, MIXED: Layers } as const;

export function ModuleEditor({ moduleId, units: initial }: { moduleId: string; units: UnitRow[] }) {
  const t = useTranslations("admin.content");
  const te = useTranslations("errors");
  const [units, setUnits] = useState(initial);
  const [, startTransition] = useTransition();
  // Resynchronise quand le serveur renvoie une nouvelle version (après création/suppression).
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setUnits(initial);
  }

  const persist = (scope: "unit" | "lesson", parentId: string, ids: string[], rollback: () => void) =>
    startTransition(async () => {
      const res = await reorderAction(null, { scope, parentId, orderedIds: ids });
      if (!res.ok) {
        rollback();
        toast.error(te.has(res.error) ? te(res.error) : te("generic"));
      }
    });

  return (
    <div className="grid gap-6">
      <div>
        <ConfirmAction
          action={createUnitAction}
          fields={{ moduleId }}
          trigger={
            <Button>
              <Plus className="size-4" aria-hidden /> {t("newUnit")}
            </Button>
          }
          title={t("newUnit")}
          description={t("newUnitBody")}
          confirmLabel={t("create")}
          successMessage={t("created")}
        >
          <div className="grid gap-2">
            <Label htmlFor="unit-title">{t("fieldTitle")}</Label>
            <Input id="unit-title" name="title" required minLength={2} maxLength={160} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="unit-summary">{t("summary")}</Label>
            <Textarea id="unit-summary" name="summary" maxLength={500} rows={2} />
          </div>
        </ConfirmAction>
      </div>

      {units.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">{t("noUnits")}</p>
      ) : (
        <SortableList
          items={units}
          className="grid gap-4"
          onReorder={(next) => {
            const before = units;
            setUnits(next);
            persist("unit", moduleId, next.map((u) => u.id), () => setUnits(before));
          }}
          renderItem={(unit, handle) => (
            <div className="rounded-xl border bg-card">
              <div className="flex items-center gap-2 border-b px-3 py-3">
                {handle}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{unit.title}</p>
                  {unit.summary && <p className="truncate text-xs text-muted-foreground">{unit.summary}</p>}
                </div>
                <PublicationBadge status={unit.status} publishAt={unit.publishAt} />
                <ConfirmAction
                  action={updateUnitAction}
                  fields={{ unitId: unit.id }}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label={t("editUnit")}>
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                  }
                  title={t("editUnit")}
                  description={t("editUnitBody")}
                  confirmLabel={t("save")}
                  successMessage={t("saved")}
                >
                  <div className="grid gap-2">
                    <Label htmlFor={`t-${unit.id}`}>{t("fieldTitle")}</Label>
                    <Input id={`t-${unit.id}`} name="title" defaultValue={unit.title} required minLength={2} maxLength={160} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`s-${unit.id}`}>{t("summary")}</Label>
                    <Textarea id={`s-${unit.id}`} name="summary" defaultValue={unit.summary ?? ""} maxLength={500} rows={2} />
                  </div>
                  <PublicationFields status={unit.status} publishAt={unit.publishAt} />
                </ConfirmAction>
                <ConfirmAction
                  action={deleteUnitAction}
                  fields={{ unitId: unit.id }}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label={t("deleteUnit")}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  }
                  title={t("deleteUnit")}
                  description={t("deleteUnitBody", { count: unit.lessons.length })}
                  confirmLabel={t("delete")}
                  successMessage={t("deleted")}
                  destructive
                />
              </div>

              <div className="p-2">
                {unit.lessons.length > 0 && (
                  <SortableList
                    items={unit.lessons}
                    className="grid gap-1"
                    onReorder={(next) => {
                      const before = units;
                      setUnits(units.map((u) => (u.id === unit.id ? { ...u, lessons: next } : u)));
                      persist("lesson", unit.id, next.map((l) => l.id), () => setUnits(before));
                    }}
                    renderItem={(lesson, lessonHandle) => {
                      const Icon = TYPE_ICON[lesson.type];
                      return (
                        <div className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-accent/50">
                          {lessonHandle}
                          <Icon className="size-4 text-muted-foreground" aria-label={t(`lessonType.${lesson.type}`)} />
                          <Link href={`/admin/content/lessons/${lesson.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
                            {lesson.title}
                          </Link>
                          <span className="hidden text-xs text-muted-foreground sm:inline">{t("blocksCount", { count: lesson.blocks })}</span>
                          <PublicationBadge status={lesson.status} publishAt={lesson.publishAt} />
                          <ConfirmAction
                            action={deleteLessonAction}
                            fields={{ lessonId: lesson.id }}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label={t("deleteLesson")}>
                                <Trash2 className="size-4" aria-hidden />
                              </Button>
                            }
                            title={t("deleteLesson")}
                            description={t("deleteLessonBody", { title: lesson.title })}
                            confirmLabel={t("delete")}
                            successMessage={t("deleted")}
                            destructive
                          />
                        </div>
                      );
                    }}
                  />
                )}
                <ConfirmAction
                  action={createLessonAction}
                  fields={{ unitId: unit.id }}
                  trigger={
                    <Button variant="ghost" size="sm" className="mt-1 text-muted-foreground">
                      <Plus className="size-4" aria-hidden /> {t("newLesson")}
                    </Button>
                  }
                  title={t("newLesson")}
                  description={t("newLessonBody")}
                  confirmLabel={t("create")}
                  successMessage={t("created")}
                >
                  <div className="grid gap-2">
                    <Label htmlFor={`l-${unit.id}`}>{t("fieldTitle")}</Label>
                    <Input id={`l-${unit.id}`} name="title" required minLength={2} maxLength={160} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`lt-${unit.id}`}>{t("lessonTypeLabel")}</Label>
                    <select id={`lt-${unit.id}`} name="type" className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue="TEXT">
                      {(["TEXT", "VIDEO", "MIXED"] as const).map((ty) => (
                        <option key={ty} value={ty}>
                          {t(`lessonType.${ty}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </ConfirmAction>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}

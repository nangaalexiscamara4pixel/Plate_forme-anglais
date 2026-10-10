"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/server/actions";

type ServerAction = (prev: ActionResult | null, data: FormData) => Promise<ActionResult>;

/**
 * Bouton + boîte de confirmation pour une action d'administration.
 * Les champs cachés (`fields`) identifient la cible ; `withReason` ajoute un motif facultatif.
 */
export function ConfirmAction({
  action,
  fields,
  trigger,
  title,
  description,
  confirmLabel,
  successMessage,
  destructive = false,
  withReason = false,
  children,
}: {
  action: ServerAction;
  fields: Record<string, string>;
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  successMessage: string;
  destructive?: boolean;
  withReason?: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations("admin.student");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [, formAction, pending] = useActionState(async (prev: ActionResult | null, data: FormData) => {
    const result = await action(prev, data);
    if (result.ok) {
      toast.success(successMessage);
      setOpen(false);
    } else {
      toast.error(te.has(result.error) ? te(result.error) : te("generic"));
    }
    return result;
  }, null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {children}
          {withReason && (
            <div className="grid gap-2">
              <Label htmlFor="reason">{t("reasonLabel")}</Label>
              <Textarea id="reason" name="reason" maxLength={500} rows={3} placeholder={t("reasonPlaceholder")} />
              <p className="text-xs text-muted-foreground">{t("reasonHint")}</p>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

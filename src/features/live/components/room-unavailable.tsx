"use client";

import { Clock, DoorClosed, Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { GlobeMark } from "@/components/brand/logo";
import { Link, useRouter } from "@/i18n/navigation";
import { formatClock, useNow } from "./use-room";

/** Salle pas encore ouverte (compte à rebours, entrée automatique), terminée, ou consultée en impersonation. */
export function RoomUnavailable({
  reason,
  title,
  opensAt,
  backHref,
  serverNow,
}: {
  reason: "notOpen" | "closed" | "readOnly";
  title: string;
  opensAt: string;
  backHref: string;
  serverNow: number;
}) {
  const t = useTranslations("live.room");
  const router = useRouter();
  const now = useNow(serverNow);
  const remaining = Date.parse(opensAt) - now;
  useEffect(() => {
    if (reason === "notOpen" && remaining <= 0) router.refresh();
  }, [reason, remaining, router]);
  const Icon = reason === "notOpen" ? Clock : reason === "readOnly" ? Eye : DoorClosed;
  return (
    <div className="dark fixed inset-0 flex flex-col items-center justify-center gap-5 bg-[radial-gradient(60%_50%_at_50%_0%,oklch(0.33_0.11_264),oklch(0.16_0.045_264))] px-6 text-center text-white">
      <GlobeMark className="size-12 text-white" />
      <span className="flex size-14 items-center justify-center rounded-2xl bg-white/10">
        <Icon className="size-7 text-brand-soft" aria-hidden />
      </span>
      <div className="max-w-md">
        <p className="text-sm text-white/60">{title}</p>
        <h1 className="mt-1 font-display text-3xl">{t(`unavailable.${reason}.title`)}</h1>
        <p className="mt-2 text-white/65">{t(`unavailable.${reason}.text`)}</p>
      </div>
      {reason === "notOpen" && (
        <p className="font-display text-5xl tabular-nums" role="timer" aria-live="off">
          {formatClock(remaining)}
        </p>
      )}
      <Link href={backHref} className="rounded-xl bg-white/10 px-5 py-2.5 font-semibold hover:bg-white/15">
        {t("back")}
      </Link>
    </div>
  );
}

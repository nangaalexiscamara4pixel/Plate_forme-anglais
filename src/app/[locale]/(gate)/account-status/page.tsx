import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { requireGate } from "@/server/dal/guards";

export const metadata: Metadata = { robots: { index: false } };

export default async function AccountStatusPage() {
  const viewer = await requireGate("account-status");
  const t = await getTranslations("gate.status");
  const { statusReason } = await db.user.findUniqueOrThrow({
    where: { id: viewer.userId },
    select: { statusReason: true },
  });
  const key = viewer.status === "SUSPENDED" ? "SUSPENDED" : "REJECTED";

  return (
    <div className="w-full max-w-lg text-center">
      <span className="mx-auto mb-8 flex size-20 items-center justify-center rounded-full border bg-card">
        <ShieldAlert className="size-9 text-muted-foreground" aria-hidden />
      </span>
      <h1 className="mb-4 text-3xl font-medium text-balance">{t(`${key}.title`)}</h1>
      <p className="leading-relaxed text-muted-foreground">{t(`${key}.body`)}</p>
      {statusReason && (
        <p className="mt-6 rounded-lg border bg-card px-4 py-3 text-sm">{t("reason", { reason: statusReason })}</p>
      )}
      <p className="mt-6 text-sm text-muted-foreground">{t("contact")}</p>
    </div>
  );
}

"use client";

import { Monitor, Smartphone } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { describeUserAgent } from "@/lib/user-agent";
import { revokeSessionAction } from "../actions";
import { ConfirmAction } from "./confirm-action";

export type SessionRow = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  impersonatedBy: string | null;
};

export function StudentSessionList({ studentId, sessions, timeZone }: { studentId: string; sessions: SessionRow[]; timeZone: string }) {
  const t = useTranslations("admin.student");
  const format = useFormatter();
  if (sessions.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{t("noSessions")}</p>;

  return (
    <ul className="divide-y">
      {sessions.map((s) => {
        const ua = describeUserAgent(s.userAgent);
        const Icon = ua.mobile ? Smartphone : Monitor;
        return (
          <li key={s.id} className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3">
              <Icon className="size-5 text-muted-foreground" aria-hidden />
              <div className="text-sm">
                <p className="font-medium">
                  {ua.label}
                  {s.impersonatedBy && <span className="ml-2 text-xs text-destructive">{t("impersonationSession")}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("sessionMeta", {
                    ip: s.ipAddress ?? "—",
                    created: format.dateTime(s.createdAt, { dateStyle: "medium", timeStyle: "short", timeZone }),
                    active: format.relativeTime(s.updatedAt),
                  })}
                </p>
              </div>
            </div>
            <ConfirmAction
              action={revokeSessionAction}
              fields={{ studentId, sessionId: s.id }}
              trigger={
                <Button variant="ghost" size="sm">
                  {t("revoke")}
                </Button>
              }
              title={t("revokeOneTitle")}
              description={t("revokeOneBody")}
              confirmLabel={t("revoke")}
              successMessage={t("revoked")}
              destructive
            />
          </li>
        );
      })}
    </ul>
  );
}

import { Monitor, ShieldCheck, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm, RevokeOtherSessionsForm } from "@/features/account/components/account-forms";
import { PageHeader } from "@/features/admin-shell/ui";
import { describeUserAgent } from "@/lib/user-agent";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/dal/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.account");
  return { title: t("title") };
}

export default async function AdminAccountPage() {
  const admin = await requireAdmin();
  const t = await getTranslations("admin.account");
  const format = await getFormatter();
  const sessions = await db.session.findMany({
    where: { userId: admin.userId, expiresAt: { gt: new Date() } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, createdAt: true, updatedAt: true, ipAddress: true, userAgent: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-sans text-base">
            <ShieldCheck className="size-4 text-success" aria-hidden /> {t("twoFactorOn")}
          </CardTitle>
          <CardDescription>{t("twoFactorBody")}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-base">{t("password")}</CardTitle>
          <CardDescription>{t("passwordBody")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm userInputs={[admin.name, admin.email]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-base">{t("sessions")}</CardTitle>
          <CardDescription>{t("sessionsBody")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ul className="divide-y">
            {sessions.map((s) => {
              const ua = describeUserAgent(s.userAgent);
              const Icon = ua.mobile ? Smartphone : Monitor;
              return (
                <li key={s.id} className="flex items-center gap-3 py-3 text-sm">
                  <Icon className="size-5 text-muted-foreground" aria-hidden />
                  <span className="flex-1">
                    <span className="font-medium">{ua.label}</span>
                    {s.id === admin.sessionId && <span className="ml-2 text-xs text-success">{t("thisDevice")}</span>}
                    <span className="block text-xs text-muted-foreground">
                      {s.ipAddress ?? "—"} · {format.dateTime(s.createdAt, { dateStyle: "medium", timeStyle: "short", timeZone: admin.timezone })}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {sessions.length > 1 && <RevokeOtherSessionsForm />}
        </CardContent>
      </Card>
    </div>
  );
}

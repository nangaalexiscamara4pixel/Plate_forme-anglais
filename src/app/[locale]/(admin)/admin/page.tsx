import { getFormatter, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PendingApplication } from "@/features/approval/components/pending-application";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/dal/guards";

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"] as const;

export default async function AdminHomePage() {
  await requireAdmin();
  const t = await getTranslations("admin");
  const format = await getFormatter();

  const [counts, pending, levels] = await Promise.all([
    db.user.groupBy({ by: ["status"], where: { role: "STUDENT", deletedAt: null }, _count: true }),
    db.user.findMany({
      where: { role: "STUDENT", status: "PENDING", emailVerified: true, deletedAt: null },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: { id: true, name: true, email: true, createdAt: true, profile: { select: { country: true, timezone: true } } },
    }),
    db.level.findMany({ orderBy: { order: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  const countOf = (s: (typeof STATUSES)[number]) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-medium">{t("title")}</h1>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Statistiques">
        {STATUSES.map((s) => (
          <Card key={s} className={s === "PENDING" && countOf(s) > 0 ? "ring-2 ring-gold/40" : undefined}>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">{t(`stats.${s}`)}</p>
              <p className="font-display text-4xl">{countOf(s)}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl font-medium">{t("pendingTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t("pendingEmpty")}</p>
          ) : (
            <ul className="divide-y">
              {pending.map((u) => (
                <PendingApplication
                  key={u.id}
                  student={{
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    meta: [
                      t("registeredOn", { date: format.dateTime(u.createdAt, { dateStyle: "medium" }) }),
                      u.profile?.country,
                      u.profile?.timezone,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  }}
                  levels={levels}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

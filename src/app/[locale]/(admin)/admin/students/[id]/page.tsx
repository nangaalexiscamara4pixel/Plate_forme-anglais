import { ArrowLeft, BookOpenCheck, CalendarCheck, FileText, GraduationCap, History, Monitor, UserRound } from "lucide-react";
import { actionKey } from "@/features/audit/format";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auditDetails } from "@/features/audit/format";
import { EmptyState, LevelBadge, StatusBadge } from "@/features/admin-shell/ui";
import { StudentAdminPanel } from "@/features/students/components/admin-panel";
import { StudentSessionList } from "@/features/students/components/session-list";
import { getStudentDetail } from "@/features/students/queries";
import { recordStudentView } from "@/features/students/service";
import { Link } from "@/i18n/navigation";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/dal/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.student");
  return { title: t("pageTitle") };
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!/^[\w-]{1,64}$/.test(id)) notFound();
  const detail = await getStudentDetail(id);
  if (!detail) notFound();
  await recordStudentView({ actorId: admin.userId, ip: admin.ip, userAgent: admin.userAgent }, id);

  const { student, auditTrail, attendance, recentAttempts, recentSubmissions } = detail;
  const t = await getTranslations("admin.student");
  const ta = await getTranslations("admin.auditActions");
  const tl = await getTranslations("levels");
  const format = await getFormatter();
  const levels = await db.level.findMany({ orderBy: { order: "asc" }, select: { id: true, code: true, name: true } });
  const tz = admin.timezone;
  const dt = (d: Date | null | undefined, withTime = false) =>
    d ? format.dateTime(d, { dateStyle: "medium", ...(withTime ? { timeStyle: "short" } : {}), timeZone: tz }) : "—";
  const locale = await getLocale();
  const countryName = student.profile?.country
    ? (new Intl.DisplayNames([locale], { type: "region" }).of(student.profile.country) ?? student.profile.country)
    : "—";
  const attendanceOf = (s: string) => attendance.find((a) => a.status === s)?._count ?? 0;
  const locked = student.lockedUntil && student.lockedUntil > new Date();

  return (
    <div className="space-y-8">
      <Link href="/admin/students" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {t("back")}
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent font-display text-xl text-gold-ink" aria-hidden>
            {student.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <div>
            <h1 className="text-3xl font-medium">{student.name}</h1>
            <p className="text-sm text-muted-foreground">{student.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={student.status} />
          {student.currentLevel && <LevelBadge code={student.currentLevel.code} name={tl(`${student.currentLevel.code}.name`)} />}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Tabs defaultValue="profile" className="min-w-0">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="profile">
              <UserRound className="size-4" aria-hidden /> {t("tabs.profile")}
            </TabsTrigger>
            <TabsTrigger value="progress">
              <GraduationCap className="size-4" aria-hidden /> {t("tabs.progress")}
            </TabsTrigger>
            <TabsTrigger value="attendance">
              <CalendarCheck className="size-4" aria-hidden /> {t("tabs.attendance")}
            </TabsTrigger>
            <TabsTrigger value="sessions">
              <Monitor className="size-4" aria-hidden /> {t("tabs.sessions")} ({student.sessions.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="size-4" aria-hidden /> {t("tabs.history")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4 grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-sans text-base">{t("identity")}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <Info label={t("country")}>{countryName}</Info>
                  <Info label={t("timezone")}>{student.profile?.timezone ?? "—"}</Info>
                  <Info label={t("language")}>{student.profile?.uiLocale?.toUpperCase() ?? "—"}</Info>
                  <Info label={t("nativeLanguage")}>{student.profile?.nativeLanguage ?? "—"}</Info>
                  <Info label={t("registered")}>{dt(student.createdAt, true)}</Info>
                  <Info label={t("lastLogin")}>{dt(student.lastLoginAt, true)}</Info>
                </dl>
                {student.profile?.goals && (
                  <div className="mt-5">
                    <Info label={t("goals")}>{student.profile.goals}</Info>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-sans text-base">{t("accountSecurity")}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <Info label={t("emailVerified")}>{student.emailVerified ? t("yes") : t("no")}</Info>
                  <Info label={t("twoFactor")}>{student.twoFactorEnabled ? t("enabled") : t("disabled")}</Info>
                  <Info label={t("failedLogins")}>
                    {student.failedLoginCount}
                    {locked && <span className="ml-2 text-destructive">{t("lockedUntil", { date: dt(student.lockedUntil, true) })}</span>}
                  </Info>
                  <Info label={t("statusChanged")}>
                    {student.statusChangedAt
                      ? t("statusChangedBy", { date: dt(student.statusChangedAt, true), name: student.statusChangedBy?.name ?? "—" })
                      : "—"}
                  </Info>
                  {student.statusReason && <Info label={t("statusReason")}>{student.statusReason}</Info>}
                  <Info label={t("consent")}>
                    {student.profile?.privacyConsentAt
                      ? `${dt(student.profile.privacyConsentAt)} (v${student.profile.privacyPolicyVersion ?? "?"})`
                      : "—"}
                  </Info>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-sans text-base">{t("levelHistory")}</CardTitle>
              </CardHeader>
              <CardContent>
                {student.enrollments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noEnrollment")}</p>
                ) : (
                  <ol className="grid gap-3">
                    {student.enrollments.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <LevelBadge code={e.level.code} name={tl(`${e.level.code}.name`)} />
                        <span className="text-muted-foreground">
                          {t(`enrollment.${e.status}`)} · {dt(e.startedAt)}
                          {e.completedAt ? ` → ${dt(e.completedAt)}` : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="progress" className="mt-4 grid gap-6">
            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                [t("lessonsCompleted"), student._count.lessonProgress],
                [t("attempts"), student._count.attempts],
                [t("submissions"), student._count.submissions],
                [t("certificates"), student._count.certificates],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border bg-card p-4">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="font-display text-3xl">{value}</dd>
                </div>
              ))}
            </dl>
            <Card>
              <CardHeader>
                <CardTitle className="font-sans text-base">{t("recentAttempts")}</CardTitle>
              </CardHeader>
              <CardContent>
                {recentAttempts.length === 0 ? (
                  <EmptyState icon={<BookOpenCheck className="size-5" aria-hidden />} title={t("noAttempts")} body={t("noDataYet")} />
                ) : (
                  <ul className="divide-y text-sm">
                    {recentAttempts.map((a) => (
                      <li key={a.id} className="flex justify-between gap-4 py-2">
                        <span>{a.exercise.title}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {a.score}/{a.maxScore} · {dt(a.submittedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-sans text-base">{t("recentSubmissions")}</CardTitle>
              </CardHeader>
              <CardContent>
                {recentSubmissions.length === 0 ? (
                  <EmptyState icon={<FileText className="size-5" aria-hidden />} title={t("noSubmissions")} body={t("noDataYet")} />
                ) : (
                  <ul className="divide-y text-sm">
                    {recentSubmissions.map((s) => (
                      <li key={s.id} className="flex justify-between gap-4 py-2">
                        <span>{s.assignment.title}</span>
                        <span className="text-muted-foreground">
                          {s.feedback?.score ?? "—"} · {dt(s.submittedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance" className="mt-4">
            {student._count.attendances === 0 ? (
              <EmptyState icon={<CalendarCheck className="size-5" aria-hidden />} title={t("noAttendance")} body={t("noDataYet")} />
            ) : (
              <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {(["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const).map((s) => (
                  <div key={s} className="rounded-xl border bg-card p-4">
                    <dt className="text-sm text-muted-foreground">{t(`attendanceStatus.${s}`)}</dt>
                    <dd className="font-display text-3xl">{attendanceOf(s)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </TabsContent>

          <TabsContent value="sessions" className="mt-4">
            <Card>
              <CardContent className="pt-2">
                <StudentSessionList studentId={student.id} sessions={student.sessions} timeZone={tz} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardContent className="pt-2">
                {auditTrail.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">{t("noHistory")}</p>
                ) : (
                  <ol className="divide-y">
                    {auditTrail.map((a) => (
                      <li key={a.id} className="grid gap-0.5 py-3 text-sm">
                        <span>
                          <span className="font-medium">{ta.has(actionKey(a.action)) ? ta(actionKey(a.action)) : a.action}</span>
                          {auditDetails(a.metadata) && <span className="text-muted-foreground"> · {auditDetails(a.metadata)}</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {a.actor?.name ?? "—"} · {dt(a.createdAt, true)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <aside>
          <Card className="lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle className="font-sans text-base">{t("manage")}</CardTitle>
            </CardHeader>
            <CardContent>
              <StudentAdminPanel
                student={{ id: student.id, name: student.name, status: student.status, currentLevelId: student.currentLevelId }}
                levels={levels}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

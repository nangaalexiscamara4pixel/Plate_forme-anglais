import { AudioLines, FileText, ImageIcon, MonitorPlay, Pencil, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/features/admin-shell/ui";
import { deleteMediaAction } from "@/features/content/actions";
import { getMediaLibrary } from "@/features/content/admin-queries";
import { FileUploader, VideoUploader } from "@/features/content/components/media-uploaders";
import { formatClock } from "@/features/video/captions";
import { ConfirmAction } from "@/features/students/components/confirm-action";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/server/dal/guards";
import { muxEnabled } from "@/server/video";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.media");
  return { title: t("title") };
}

const FILE_ICON = { LESSON_AUDIO: AudioLines, LESSON_IMAGE: ImageIcon, LESSON_DOCUMENT: FileText } as Record<string, typeof FileText>;

export default async function MediaLibraryPage() {
  const admin = await requireAdmin();
  const t = await getTranslations("admin.media");
  const format = await getFormatter();
  const { videos, files } = await getMediaLibrary();
  const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} Mo` : `${Math.ceil(b / 1024)} Ko`);

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl font-medium">{t("videos")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <VideoUploader muxEnabled={muxEnabled} />
          {videos.length === 0 ? (
            <EmptyState icon={<MonitorPlay className="size-5" aria-hidden />} title={t("noVideos")} />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("videoTitle")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("duration")}</TableHead>
                    <TableHead>{t("subtitles")}</TableHead>
                    <TableHead>{t("usage")}</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">{t("actions")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <span className="font-medium">{v.title}</span>
                        <span className="block text-xs text-muted-foreground">{v.provider === "MUX" ? "Mux" : t("localVideo")}</span>
                      </TableCell>
                      <TableCell>{t(`videoStatus.${v.status}`)}</TableCell>
                      <TableCell className="tabular-nums">{v.durationSec ? formatClock(v.durationSec) : "—"}</TableCell>
                      <TableCell>{v.tracks.map((tr) => tr.lang.toUpperCase()).join(" · ") || "—"}</TableCell>
                      <TableCell>{t("usedIn", { count: v._count.blocks })}</TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="icon" aria-label={t("editVideo", { title: v.title })}>
                          <Link href={`/admin/media/videos/${v.id}`}>
                            <Pencil className="size-4" aria-hidden />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl font-medium">{t("files")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <FileUploader />
          {files.length === 0 ? (
            <EmptyState icon={<FileText className="size-5" aria-hidden />} title={t("noFiles")} />
          ) : (
            <ul className="divide-y rounded-lg border">
              {files.map((f) => {
                const Icon = FILE_ICON[f.purpose] ?? FileText;
                return (
                  <li key={f.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                    <a href={`/api/media/${f.id}`} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate font-medium hover:underline">
                      {f.originalName ?? f.id}
                    </a>
                    <span className="text-xs text-muted-foreground">
                      {size(f.sizeBytes)} · {format.dateTime(f.createdAt, { dateStyle: "medium", timeZone: admin.timezone })}
                    </span>
                    <ConfirmAction
                      action={deleteMediaAction}
                      fields={{ mediaId: f.id }}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={t("deleteFile")}>
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      }
                      title={t("deleteFile")}
                      description={t("deleteFileBody")}
                      confirmLabel={t("delete")}
                      successMessage={t("fileDeleted")}
                      destructive
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

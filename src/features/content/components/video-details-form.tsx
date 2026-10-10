"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Field, FormAlert, SubmitButton } from "@/components/forms";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateVideoAction } from "../actions";

export function VideoDetailsForm({
  video,
}: {
  video: { id: string; title: string; chapters: string; subtitlesEn: string; subtitlesFr: string };
}) {
  const t = useTranslations("admin.media");
  const [state, action] = useActionState(updateVideoAction, null);
  const counts = state?.ok ? (state.data as { chapters: number; en: number; fr: number } | undefined) : undefined;

  return (
    <form action={action} className="grid gap-5">
      <FormAlert state={state} success={counts ? t("videoSaved", counts) : t("saved")} />
      <input type="hidden" name="videoId" value={video.id} />
      <Field name="title" label={t("videoTitle")} state={state} defaultValue={video.title} required maxLength={160} />
      <div className="grid gap-2">
        <Label htmlFor="chapters">{t("chapters")}</Label>
        <Textarea id="chapters" name="chapters" rows={5} defaultValue={video.chapters} placeholder={"0:00 Introduction\n1:25 Greetings"} className="font-mono text-sm" />
        <p className="text-xs text-muted-foreground">{t("chaptersHint")}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="subtitlesEn">{t("subtitlesEn")}</Label>
          <Textarea id="subtitlesEn" name="subtitlesEn" rows={10} defaultValue={video.subtitlesEn} className="font-mono text-xs" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="subtitlesFr">{t("subtitlesFr")}</Label>
          <Textarea id="subtitlesFr" name="subtitlesFr" rows={10} defaultValue={video.subtitlesFr} className="font-mono text-xs" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("subtitlesHint")}</p>
      <SubmitButton className="w-fit">{t("save")}</SubmitButton>
    </form>
  );
}

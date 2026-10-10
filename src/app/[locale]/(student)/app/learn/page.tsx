import { getLocale } from "next-intl/server";
import { getAccessibleLevels } from "@/features/learn/queries";
import { levelHref } from "@/features/learn/skills";
import { redirect } from "@/i18n/navigation";
import { requireApprovedStudent } from "@/server/dal/guards";

/** « Mes cours » ouvre directement le niveau actuel de l'étudiant. */
export default async function LearnIndexPage() {
  const viewer = await requireApprovedStudent();
  const { current } = await getAccessibleLevels(viewer.userId);
  redirect({ href: current ? levelHref(current.code) : "/app", locale: await getLocale() });
}

import { BookOpen, Ear, Mic, PenLine, type LucideIcon } from "lucide-react";
import type { SkillCode } from "@/generated/prisma/client";

export const SKILL_ICON: Record<SkillCode, LucideIcon> = {
  READING: BookOpen,
  LISTENING: Ear,
  SPEAKING: Mic,
  WRITING: PenLine,
};

export const levelHref = (code: string) => `/app/learn/${code.toLowerCase()}`;
export const skillHref = (code: string, skill: string) => `${levelHref(code)}/${skill.toLowerCase()}`;
export const lessonHref = (code: string, skill: string, unit: string, lesson: string) => `${skillHref(code, skill)}/${unit}/${lesson}`;

import { Compass, Crown, Globe2, Telescope, type LucideIcon } from "lucide-react";

export type LevelCode = "A1" | "A2" | "B1" | "B2";

/** Identité visuelle de chaque niveau (couleur d'accent + icône). */
export const LEVEL_THEME: Record<LevelCode, { icon: LucideIcon; text: string; bg: string; ring: string; soft: string }> = {
  A1: { icon: Compass, text: "text-level-a1", bg: "bg-level-a1", ring: "ring-level-a1/30", soft: "bg-level-a1/10" },
  A2: { icon: Telescope, text: "text-level-a2", bg: "bg-level-a2", ring: "ring-level-a2/30", soft: "bg-level-a2/10" },
  B1: { icon: Globe2, text: "text-level-b1", bg: "bg-level-b1", ring: "ring-level-b1/30", soft: "bg-level-b1/10" },
  B2: { icon: Crown, text: "text-level-b2", bg: "bg-level-b2", ring: "ring-level-b2/30", soft: "bg-level-b2/10" },
};

export const LEVEL_CODES: LevelCode[] = ["A1", "A2", "B1", "B2"];

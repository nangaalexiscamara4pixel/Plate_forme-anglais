import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import type { AccountStatus, Role } from "@/generated/prisma/client";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

/**
 * Identité de la personne qui fait la requête, construite UNIQUEMENT à partir
 * de la session serveur (jamais d'un identifiant envoyé par le client).
 * Le statut, le rôle et le niveau sont relus en base à chaque requête :
 * une suspension ou un changement de niveau s'applique immédiatement.
 */
export type Viewer = {
  userId: string;
  sessionId: string;
  sessionCreatedAt: Date;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  status: AccountStatus;
  levelId: string | null;
  twoFactorEnabled: boolean;
  /** Fuseau IANA du profil — toutes les dates affichées à cette personne l'utilisent. */
  timezone: string;
  /** Renseigné quand un administrateur consulte la plateforme « en tant que » cet étudiant. */
  impersonatedBy: string | null;
  ip: string | null;
  userAgent: string | null;
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      status: true,
      currentLevelId: true,
      twoFactorEnabled: true,
      deletedAt: true,
      profile: { select: { timezone: true } },
    },
  });
  if (!user || user.deletedAt) return null;

  return {
    userId: user.id,
    sessionId: session.session.id,
    sessionCreatedAt: new Date(session.session.createdAt),
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    status: user.status,
    levelId: user.currentLevelId,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    timezone: user.profile?.timezone ?? "Europe/Paris",
    impersonatedBy: (session.session as { impersonatedBy?: string | null }).impersonatedBy ?? null,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  };
});

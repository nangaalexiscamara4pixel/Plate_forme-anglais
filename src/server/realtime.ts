import "server-only";
import { Client } from "pg";
import { env } from "@/env";
import type { BusEvent } from "@/features/live/rules";
import { db } from "@/server/db";
import { logger } from "@/server/logger";

/**
 * Bus temps réel de la salle virtuelle, basé sur Postgres LISTEN/NOTIFY : fonctionne avec
 * plusieurs instances du serveur, sans service supplémentaire. Chaque instance garde UNE
 * connexion d'écoute et redistribue les événements aux flux SSE de ses visiteurs.
 * Les charges utiles restent petites (< 8 000 octets, limite de NOTIFY) : un message de chat
 * fait au plus 500 caractères.
 */
const CHANNEL = "live_room";

type Listener = (event: BusEvent) => void;
type Bus = { client: Client | null; connecting: Promise<void> | null; listeners: Map<string, Set<Listener>> };

// Conservé entre les rechargements à chaud en développement.
const g = globalThis as unknown as { liveBus?: Bus };
const bus: Bus = (g.liveBus ??= { client: null, connecting: null, listeners: new Map() });

/** Ouvre (ou rouvre après une coupure) la connexion d'écoute. Appelé aussi à chaque pulsation. */
export async function ensureListening(): Promise<void> {
  if (bus.client) return;
  bus.connecting ??= (async () => {
    const client = new Client({ connectionString: env.DATABASE_URL });
    client.on("notification", (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      try {
        const { sessionId, event } = JSON.parse(msg.payload) as { sessionId: string; event: BusEvent };
        bus.listeners.get(sessionId)?.forEach((listener) => listener(event));
      } catch (err) {
        logger.warn({ err }, "événement temps réel illisible");
      }
    });
    const drop = () => {
      if (bus.client === client) bus.client = null;
    };
    client.on("error", (err) => {
      logger.warn({ err }, "connexion temps réel interrompue");
      drop();
      client.end().catch(() => {});
    });
    client.on("end", drop);
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    bus.client = client;
  })().finally(() => {
    bus.connecting = null;
  });
  await bus.connecting;
}

export async function subscribe(sessionId: string, listener: Listener): Promise<() => void> {
  await ensureListening();
  let set = bus.listeners.get(sessionId);
  if (!set) bus.listeners.set(sessionId, (set = new Set()));
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) bus.listeners.delete(sessionId);
  };
}

export async function publish(sessionId: string, event: BusEvent): Promise<void> {
  await db.$executeRaw`SELECT pg_notify(${CHANNEL}, ${JSON.stringify({ sessionId, event })})`;
}

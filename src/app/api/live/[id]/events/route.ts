import type { NextRequest } from "next/server";
import { getRoster, leavePresence, resolveRoom, stillAllowed, touchPresence } from "@/features/live/server";
import { HEARTBEAT_SEC, type RoomEvent } from "@/features/live/rules";
import { logger } from "@/server/logger";
import { ensureListening, publish, subscribe } from "@/server/realtime";

export const dynamic = "force-dynamic";
// Flux long : sur Vercel, la fonction vit jusqu'à 5 min, puis le navigateur se reconnecte seul.
export const maxDuration = 300;

/**
 * Flux temps réel d'une salle (Server-Sent Events) : chat, likes, réactions, mains levées,
 * liste des présents. Accès contrôlé comme les pages ; revérifié à chaque pulsation (compte
 * suspendu, déconnexion, séance annulée ou terminée ⇒ le flux se ferme).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[\w-]{1,64}$/.test(id)) return new Response(null, { status: 404 });
  let room;
  try {
    room = await resolveRoom(id);
  } catch {
    return new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const { viewer } = room;
  // En impersonation, l'administrateur observe sans apparaître dans la salle.
  const present = !viewer.impersonatedBy;
  const encoder = new TextEncoder();
  let cleanup: () => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let lastRoster = "";
      let rosterTimer: ReturnType<typeof setTimeout> | null = null;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const send = (event: RoomEvent) => write(`data: ${JSON.stringify(event)}\n\n`);
      const pushRoster = async (force = false) => {
        const roster = await getRoster(id);
        const json = JSON.stringify(roster);
        if (force || json !== lastRoster) {
          lastRoster = json;
          send({ type: "roster", roster });
        }
      };
      // Plusieurs changements rapprochés (arrivées, mains levées) ⇒ une seule requête.
      const scheduleRoster = () => {
        if (rosterTimer) return;
        rosterTimer = setTimeout(() => {
          rosterTimer = null;
          pushRoster().catch(() => {});
        }, 250);
      };

      const unsubscribe = await subscribe(id, (event) => {
        if (event.type === "roster") scheduleRoster();
        else send(event);
      });

      const heartbeat = setInterval(async () => {
        try {
          await ensureListening();
          if (!(await stillAllowed(viewer, id))) {
            send({ type: "closed" });
            return cleanup();
          }
          write(": ping\n\n");
          if (present && (await touchPresence(id, viewer.userId))) await publish(id, { type: "roster" });
          await pushRoster(); // rattrape aussi les départs sans fermeture propre
        } catch (err) {
          logger.warn({ err }, "pulsation de salle en échec");
        }
      }, HEARTBEAT_SEC * 1000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        if (rosterTimer) clearTimeout(rosterTimer);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // déjà fermé
        }
        if (present) {
          leavePresence(id, viewer.userId)
            .then(() => publish(id, { type: "roster" }))
            .catch(() => {});
        }
      };
      request.signal.addEventListener("abort", () => cleanup());

      write(`retry: 3000\n\n`);
      if (present) {
        await touchPresence(id, viewer.userId);
        await publish(id, { type: "roster" });
      }
      await pushRoster(true);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

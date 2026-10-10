import type { ReactNode } from "react";
import { GlobeMark } from "@/components/brand/logo";

/** Écran d'erreur commun (404, 403, 500). */
export function ErrorScreen({ code, title, body, action }: { code: string; title: string; body: string; action?: ReactNode }) {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-grain px-4">
      <div className="max-w-md text-center">
        <GlobeMark className="mx-auto mb-8 size-16 text-muted-foreground/60" />
        <p className="font-display text-6xl font-light text-gold-ink">{code}</p>
        <h1 className="mt-4 text-2xl font-medium">{title}</h1>
        <p className="mt-3 text-muted-foreground">{body}</p>
        {action && <div className="mt-8 flex justify-center">{action}</div>}
      </div>
    </main>
  );
}

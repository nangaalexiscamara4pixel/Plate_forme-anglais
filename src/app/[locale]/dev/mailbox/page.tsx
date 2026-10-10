import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { DEV_MAILBOX_DIR } from "@/server/email/send";

export const metadata = { title: "Boîte de réception (dev)", robots: { index: false } };

type DevEmail = { id: string; to: string[]; subject: string; html: string; text: string; sentAt: string };

/**
 * Boîte de réception de développement : affiche les emails écrits par sendEmail()
 * quand RESEND_API_KEY est vide. Inaccessible en production.
 */
export default async function DevMailboxPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const files = await readdir(DEV_MAILBOX_DIR).catch(() => [] as string[]);
  const emails = (
    await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse()
        .slice(0, 50)
        .map(async (f) => JSON.parse(await readFile(path.join(DEV_MAILBOX_DIR, f), "utf8")) as DevEmail),
    )
  ).filter(Boolean);

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-medium">Boîte de réception (développement)</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {emails.length} email(s) — dossier <code>.dev-mailbox/</code>. Cette page n&apos;existe pas en production.
      </p>
      <ul className="grid gap-4">
        {emails.map((e) => {
          const links = [...e.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replaceAll("&amp;", "&"));
          return (
            <li key={e.id} className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{e.subject}</p>
                <time className="text-xs text-muted-foreground">{new Date(e.sentAt).toLocaleString("fr-FR")}</time>
              </div>
              <p className="text-sm text-muted-foreground">À : {e.to.join(", ")}</p>
              {links.length > 0 && (
                <ul className="mt-3 grid gap-1">
                  {links.map((href) => (
                    <li key={href} className="truncate text-sm">
                      <a href={href} className="text-primary underline underline-offset-4 dark:text-brand-ink">
                        {href}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted-foreground">Texte</summary>
                <pre className="mt-2 text-xs whitespace-pre-wrap">{e.text}</pre>
              </details>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

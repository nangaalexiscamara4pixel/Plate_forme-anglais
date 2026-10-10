import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { title: "Politique de confidentialité" };

// Base de politique de confidentialité — à faire relire par votre conseil juridique
// et à compléter (identité du responsable de traitement, coordonnées du DPO…).
export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <Link href="/" className="rounded-md">
            <Logo />
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-12 leading-relaxed [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-4 [&_p]:text-muted-foreground">
        <h1 className="text-4xl font-medium">Politique de confidentialité</h1>
        <p className="mt-2 text-sm">Version 2026-10</p>

        <h2>Données collectées</h2>
        <ul>
          <li>Identité et contact : nom, adresse email, pays, fuseau horaire, langue.</li>
          <li>Données pédagogiques : progression, réponses aux exercices, devoirs écrits et enregistrements audio, présences aux cours.</li>
          <li>Données techniques de sécurité : adresse IP et navigateur associés à vos sessions, journal des connexions.</li>
        </ul>

        <h2>Finalités et bases légales</h2>
        <p>
          Vos données servent à examiner votre demande d&apos;inscription, à fournir les cours et le suivi pédagogique
          (exécution du contrat), et à sécuriser la plateforme (intérêt légitime). Aucune donnée n&apos;est vendue ni
          utilisée à des fins publicitaires.
        </p>

        <h2>Cookies</h2>
        <p>
          Seuls des cookies strictement nécessaires sont utilisés : session d&apos;authentification, préférence de langue
          et de thème. Aucun traceur publicitaire ou de mesure d&apos;audience tiers.
        </p>

        <h2>Durées de conservation</h2>
        <p>
          Les données de compte sont conservées pendant la durée de votre inscription, puis supprimées ou anonymisées.
          Les journaux de sécurité sont conservés 12 mois. Les certificats émis restent vérifiables sauf demande contraire.
        </p>

        <h2>Vos droits</h2>
        <p>
          Vous pouvez accéder à vos données, les rectifier, les exporter ou demander leur suppression depuis vos paramètres
          ou en écrivant à l&apos;administration de l&apos;Académie. Vous pouvez également saisir l&apos;autorité de
          protection des données de votre pays (en France, la CNIL).
        </p>

        <h2>Sous-traitants</h2>
        <p>
          Hébergement (Vercel, Neon), envoi d&apos;emails (Resend), vidéos (Mux), stockage de fichiers (Cloudflare R2) et
          visioconférence (Google Meet), dans le cadre de contrats conformes au RGPD.
        </p>
      </main>
    </div>
  );
}

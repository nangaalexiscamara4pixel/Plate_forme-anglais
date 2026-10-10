import { getTranslations, setRequestLocale } from "next-intl/server";
import { Hero } from "@/features/marketing/components/hero";
import { CtaSection, FaqSection, LevelsSection, LiveSection, TestimonialsSection } from "@/features/marketing/components/sections";
import { SitePhoto } from "@/features/marketing/components/site-photo";
import { SkillsExplorer } from "@/features/marketing/components/skills-explorer";

/**
 * Page d'accueil publique, inspirée de la maquette fournie : mosaïque de photos et titre en
 * surimpression, formations, compétences avec recherche, cours en direct, témoignages, FAQ.
 * Les photos se configurent dans src/features/marketing/site-config.ts.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site.photos");
  const big = "(min-width: 768px) 45vw, 100vw";
  const small = "(min-width: 768px) 25vw, 0px";

  return (
    <>
      <Hero
        tiles={{
          main: <SitePhoto name="heroMain" alt={t("heroMain")} sizes={big} priority />,
          topLeft: <SitePhoto name="heroTopLeft" alt={t("heroTopLeft")} sizes={small} />,
          bottomLeft: <SitePhoto name="heroBottomLeft" alt={t("heroBottomLeft")} sizes={small} />,
          topRight: <SitePhoto name="heroTopRight" alt={t("heroTopRight")} sizes={small} />,
          bottomRight: <SitePhoto name="heroBottomRight" alt={t("heroBottomRight")} sizes={small} />,
        }}
      />
      <LevelsSection />
      <SkillsExplorer
        photos={{
          READING: <SitePhoto name="skillReading" alt={t("skillReading")} />,
          LISTENING: <SitePhoto name="skillListening" alt={t("skillListening")} />,
          SPEAKING: <SitePhoto name="skillSpeaking" alt={t("skillSpeaking")} />,
          WRITING: <SitePhoto name="skillWriting" alt={t("skillWriting")} />,
        }}
      />
      <LiveSection />
      <TestimonialsSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}

/**
 * Configuration du site public — à personnaliser sans toucher aux composants.
 *
 * PHOTOS : déposez vos images dans `public/images/site/` (JPEG/WebP, ~1600 px de large pour
 * le héros, ~900 px pour les cartes) et renseignez `src`. Tant que `src` est vide, un visuel
 * de remplacement aux couleurs de l'Académie est affiché.
 */
export type SiteImage = { src?: string; tone: "night" | "gold" | "a1" | "a2" | "b1" | "b2" };

export const SITE_IMAGES = {
  heroMain: { tone: "night" },
  heroTopLeft: { tone: "a1" },
  heroBottomLeft: { tone: "gold" },
  heroTopRight: { tone: "b1" },
  heroBottomRight: { tone: "a2" },
  levelA1: { tone: "a1" },
  levelA2: { tone: "a2" },
  levelB1: { tone: "b1" },
  levelB2: { tone: "b2" },
  skillReading: { tone: "a2" },
  skillListening: { tone: "b1" },
  skillSpeaking: { tone: "gold" },
  skillWriting: { tone: "a1" },
  liveClass: { tone: "night" },
} satisfies Record<string, SiteImage>;

export type SiteImageKey = keyof typeof SITE_IMAGES;

/**
 * TÉMOIGNAGES : remplacez ces exemples par de vrais avis d'étudiants (avec leur accord).
 * Les entrées marquées `sample: true` ne sont JAMAIS affichées en production :
 * on ne publie pas de faux témoignages.
 */
export type Testimonial = { name: string; country: string; level: "A1" | "A2" | "B1" | "B2"; quote: { fr: string; en: string }; photo?: string; sample?: boolean };

export const TESTIMONIALS: Testimonial[] = [
  {
    sample: true,
    name: "Exemple — Aïcha",
    country: "SN",
    level: "B1",
    quote: {
      fr: "Témoignage d'exemple : remplacez-le par l'avis d'un de vos étudiants.",
      en: "Sample testimonial: replace it with a real student's review.",
    },
  },
  {
    sample: true,
    name: "Exemple — Lucas",
    country: "FR",
    level: "A2",
    quote: {
      fr: "Témoignage d'exemple : les cours en direct et les corrections personnalisées seraient mentionnés ici.",
      en: "Sample testimonial: live classes and personal feedback would be mentioned here.",
    },
  },
  {
    sample: true,
    name: "Exemple — Mei",
    country: "CN",
    level: "B2",
    quote: {
      fr: "Témoignage d'exemple : chaque avis apparaît avec le prénom, le pays et le niveau.",
      en: "Sample testimonial: each review shows first name, country and level.",
    },
  },
];

export function visibleTestimonials(): Testimonial[] {
  return process.env.NODE_ENV === "production" ? TESTIMONIALS.filter((t) => !t.sample) : TESTIMONIALS;
}

/** Réseaux sociaux affichés dans le pied de page (laisser vide pour masquer). */
export const SOCIAL_LINKS: { network: "facebook" | "instagram" | "linkedin" | "youtube"; url: string }[] = [];

/** Durée indicative de chaque niveau et difficulté (1 à 4) affichées sur les cartes. */
export const LEVEL_FACTS = {
  A1: { months: 3, difficulty: 1 },
  A2: { months: 3, difficulty: 2 },
  B1: { months: 4, difficulty: 3 },
  B2: { months: 4, difficulty: 4 },
} as const;

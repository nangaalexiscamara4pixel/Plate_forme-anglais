/**
 * Contenu de démonstration du seed : de vraies leçons d'anglais, pour tester la plateforme
 * de bout en bout (texte riche, encadrés, vocabulaire, vidéo sous-titrée avec chapitres).
 * Les exercices et devoirs s'ajoutent en phase 4.
 */
import { rt, type RichNode } from "../src/features/content/rich-text";

type Block =
  | { kind: "RICH_TEXT"; doc: RichNode }
  | { kind: "CALLOUT"; tone: "info" | "tip" | "warning" | "culture" | "grammar"; title?: string; doc: RichNode }
  | { kind: "VOCAB_LIST"; title?: string; items: { term: string; translation: string; partOfSpeech?: string; example?: string }[] }
  | { kind: "VIDEO"; caption?: string };

export type DemoLesson = { title: string; summary: string; type: "TEXT" | "VIDEO" | "MIXED"; minutes: number; blocks: Block[] };
export type DemoUnit = { title: string; summary: string; lessons: DemoLesson[] };

// Horaires alignés sur scripts/make-demo-video.mjs
export const DEMO_VIDEO = {
  title: "Hello & Goodbye — A1 dialogue",
  chapters: [
    { start: 0, title: "Introduction" },
    { start: 4, title: "Greetings" },
    { start: 12, title: "Asking how someone is" },
    { start: 20, title: "Meeting & leaving" },
  ],
  subtitles: {
    en: [
      [4, 8, "Hello!"],
      [8, 12, "Good morning."],
      [12, 16, "How are you?"],
      [16, 20, "I'm fine, thank you. And you?"],
      [20, 24, "Nice to meet you!"],
      [24, 28, "See you tomorrow. Goodbye!"],
    ],
    fr: [
      [4, 8, "Bonjour ! / Salut !"],
      [8, 12, "Bonjour (le matin)."],
      [12, 16, "Comment allez-vous ?"],
      [16, 20, "Je vais bien, merci. Et vous ?"],
      [20, 24, "Enchanté(e) !"],
      [24, 28, "À demain. Au revoir !"],
    ],
  } as Record<"en" | "fr", [number, number, string][]>,
};

const A1: Record<"READING" | "LISTENING" | "SPEAKING" | "WRITING", DemoUnit> = {
  READING: {
    title: "Meeting people",
    summary: "Read short texts where people introduce themselves.",
    lessons: [
      {
        title: "Saying hello",
        summary: "The essential words to greet someone in English.",
        type: "TEXT",
        minutes: 10,
        blocks: [
          {
            kind: "RICH_TEXT",
            doc: rt.doc(
              rt.h(2, "Formal or informal?"),
              rt.p("In English, we use different greetings depending on ", rt.b("who"), " we are talking to and ", rt.b("when"), "."),
              rt.ul("Hi! / Hello! — with friends, family and colleagues", "Good morning / Good afternoon / Good evening — more formal", "Hey! — very informal, with close friends"),
              rt.p("Read the short dialogue below."),
              rt.table(["Person", "Says"], [["Anna", "Hi, I'm Anna. What's your name?"], ["Tom", "Hello Anna! My name is Tom."], ["Anna", "Nice to meet you, Tom."], ["Tom", "Nice to meet you too!"]]),
            ),
          },
          {
            kind: "CALLOUT",
            tone: "warning",
            title: "“Good night” is not a greeting",
            doc: rt.doc(rt.p("We say ", rt.i("Good night"), " only when we leave someone in the evening or go to bed. To greet someone in the evening, say ", rt.b("Good evening"), ".")),
          },
          {
            kind: "VOCAB_LIST",
            title: "Greetings",
            items: [
              { term: "Hello", translation: "Bonjour / Salut", partOfSpeech: "interj.", example: "Hello, how are you?" },
              { term: "Good morning", translation: "Bonjour (le matin)", partOfSpeech: "expr.", example: "Good morning, Mrs Smith." },
              { term: "Nice to meet you", translation: "Enchanté(e)", partOfSpeech: "expr.", example: "Nice to meet you, Tom." },
              { term: "Goodbye", translation: "Au revoir", partOfSpeech: "interj.", example: "Goodbye, see you tomorrow!" },
            ],
          },
        ],
      },
      {
        title: "An email from Sarah",
        summary: "Read a short email and find the key information.",
        type: "TEXT",
        minutes: 12,
        blocks: [
          {
            kind: "RICH_TEXT",
            doc: rt.doc(
              rt.h(2, "Read the email"),
              rt.p(rt.b("Subject: "), "Hello from London!"),
              rt.p("Hi Lucas,"),
              rt.p("My name is Sarah and I am your new pen friend. I am 24 years old and I live in London. I am a nurse. I have one brother and two cats! I like music, cooking and walking in the park."),
              rt.p("What about you? Please write soon."),
              rt.p("Best wishes,", rt.i(" Sarah")),
              rt.h(3, "Find the information"),
              rt.ul("Where does Sarah live?", "What is her job?", "What does she like?"),
            ),
          },
          {
            kind: "CALLOUT",
            tone: "grammar",
            title: "The verb “to be”",
            doc: rt.doc(rt.table(["Full form", "Short form"], [["I am", "I'm"], ["you are", "you're"], ["she is", "she's"], ["we are", "we're"]])),
          },
        ],
      },
    ],
  },
  LISTENING: {
    title: "Everyday greetings",
    summary: "Watch and listen to people greeting each other.",
    lessons: [
      {
        title: "Hello & Goodbye — video",
        summary: "A short video with English and French subtitles.",
        type: "VIDEO",
        minutes: 8,
        blocks: [
          { kind: "VIDEO", caption: "Watch once without subtitles, then again with English subtitles." },
          {
            kind: "CALLOUT",
            tone: "tip",
            title: "How to use this video",
            doc: rt.doc(rt.ul("1st time: just listen.", "2nd time: turn on English subtitles (CC).", "3rd time: open the transcript and repeat each sentence.")),
          },
        ],
      },
      {
        title: "Listening for details",
        summary: "Check your understanding of the dialogue.",
        type: "MIXED",
        minutes: 10,
        blocks: [
          { kind: "VIDEO", caption: "Listen again and note the time of day." },
          {
            kind: "RICH_TEXT",
            doc: rt.doc(rt.h(2, "True or false?"), rt.ul("The speaker says “Good evening”.", "The other person feels fine.", "They will meet again tomorrow."), rt.p(rt.i("Interactive exercises arrive with the next update."))),
          },
        ],
      },
    ],
  },
  SPEAKING: {
    title: "Introducing yourself",
    summary: "Learn the key phrases to talk about yourself.",
    lessons: [
      {
        title: "My name is…",
        summary: "Say your name, age and where you are from.",
        type: "TEXT",
        minutes: 10,
        blocks: [
          {
            kind: "RICH_TEXT",
            doc: rt.doc(
              rt.h(2, "Useful phrases"),
              rt.ul("My name is… / I'm…", "I'm 25 (years old).", "I'm from France. I live in Lyon.", "I'm a student / an engineer."),
              rt.h(3, "Practise aloud"),
              rt.p("Read these sentences aloud three times. Then replace the words in bold with information about you:"),
              rt.p("Hi! I'm ", rt.b("Julia"), ". I'm ", rt.b("30"), ". I'm from ", rt.b("Brazil"), " and I live in ", rt.b("Paris"), ". I'm a ", rt.b("designer"), "."),
            ),
          },
          {
            kind: "CALLOUT",
            tone: "culture",
            title: "Small talk",
            doc: rt.doc(rt.p("In English-speaking countries, people often ask ", rt.i("“How are you?”"), " as a greeting. A short answer is enough: ", rt.b("“Fine, thanks! And you?”"))),
          },
        ],
      },
    ],
  },
  WRITING: {
    title: "Your first message",
    summary: "Write a short message to introduce yourself.",
    lessons: [
      {
        title: "Writing a short introduction",
        summary: "A model text and a simple structure to follow.",
        type: "TEXT",
        minutes: 15,
        blocks: [
          {
            kind: "RICH_TEXT",
            doc: rt.doc(
              rt.h(2, "A model message"),
              rt.p("Hello everyone! My name is Karim. I'm 19 and I'm from Morocco. I'm a student in Casablanca. I like football and films. Nice to meet you!"),
              rt.h(3, "The structure"),
              rt.ul("Greeting: Hello everyone!", "Name and age", "Country and city", "Job or studies", "Hobbies", "Closing: Nice to meet you!"),
            ),
          },
          {
            kind: "CALLOUT",
            tone: "tip",
            title: "Capital letters",
            doc: rt.doc(rt.p("In English, use a capital letter for ", rt.b("I"), ", names, countries, nationalities and languages: ", rt.i("I'm French. I speak English."))),
          },
        ],
      },
    ],
  },
};

const OTHER_LEVELS: Record<"A2" | "B1" | "B2", Record<"READING" | "LISTENING" | "SPEAKING" | "WRITING", [string, string, string]>> = {
  A2: {
    READING: ["Daily routines", "Reading about someone's day", "Emma gets up at 6:30, has a quick breakfast and takes the bus to work. In the evening she usually goes to the gym or meets friends."],
    LISTENING: ["At the shop", "Understanding prices and quantities", "Listen for numbers: “How much is it?” — “It's £3.50.” Write down every price you hear."],
    SPEAKING: ["Talking about the past", "Describing your last weekend", "Use the past simple: “Last weekend I visited my grandparents. We cooked lunch and watched a film.”"],
    WRITING: ["Postcards", "Writing a holiday postcard", "Start with “Dear…”, say where you are, describe the weather and one activity, then close with “Love,” or “Best wishes,”."],
  },
  B1: {
    READING: ["Travel stories", "Following a narrative", "Notice how writers use “first”, “then”, “after that” and “finally” to organise events in a story."],
    LISTENING: ["Podcasts", "Getting the main idea", "Do not try to understand every word. Listen once for the topic, a second time for the speaker's opinion."],
    SPEAKING: ["Giving opinions", "Agreeing and disagreeing politely", "“I see your point, but…”, “I completely agree.”, “I'm not sure about that.”"],
    WRITING: ["Formal emails", "Requesting information", "Use a clear subject line, a formal greeting (“Dear Sir or Madam”), one paragraph per idea and a polite closing."],
  },
  B2: {
    READING: ["Opinion articles", "Identifying the writer's stance", "Look for hedging language (“arguably”, “it could be said”) and evaluative adjectives that reveal the writer's position."],
    LISTENING: ["Lectures", "Note-taking strategies", "Use abbreviations and symbols, and listen for signposting: “The key point here is…”, “To sum up…”."],
    SPEAKING: ["Debates", "Building a persuasive argument", "Structure: claim → reason → example → counter-argument → rebuttal."],
    WRITING: ["Essays", "Writing a balanced argument", "Introduce the issue, present both sides in separate paragraphs, and give your reasoned conclusion."],
  },
};

export function demoUnits(level: "A1" | "A2" | "B1" | "B2", skill: "READING" | "LISTENING" | "SPEAKING" | "WRITING"): DemoUnit[] {
  if (level === "A1") return [A1[skill]];
  const [unitTitle, lessonTitle, body] = OTHER_LEVELS[level][skill];
  return [
    {
      title: unitTitle,
      summary: `${level} · introduction`,
      lessons: [
        {
          title: lessonTitle,
          summary: "Introductory lesson — more content coming soon.",
          type: "TEXT",
          minutes: 10,
          blocks: [
            { kind: "RICH_TEXT", doc: rt.doc(rt.h(2, lessonTitle), rt.p(body)) },
            { kind: "CALLOUT", tone: "tip", doc: rt.doc(rt.p("Your teacher will add more lessons and exercises to this unit.")) },
          ],
        },
      ],
    },
  ];
}

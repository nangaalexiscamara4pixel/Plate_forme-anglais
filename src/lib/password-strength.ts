import type { ZxcvbnResult } from "@zxcvbn-ts/core";

/** Score minimal exigé (0 à 4) — appliqué côté client ET côté serveur. */
export const MIN_PASSWORD_SCORE = 3;

let loader: Promise<(password: string, userInputs?: string[]) => ZxcvbnResult> | null = null;

/** Charge zxcvbn et ses dictionnaires à la demande (lourds : jamais dans le bundle initial). */
function load() {
  loader ??= (async () => {
    const [{ ZxcvbnFactory }, common, en, fr] = await Promise.all([
      import("@zxcvbn-ts/core"),
      import("@zxcvbn-ts/language-common"),
      import("@zxcvbn-ts/language-en"),
      import("@zxcvbn-ts/language-fr"),
    ]);
    const factory = new ZxcvbnFactory({
      graphs: common.adjacencyGraphs,
      dictionary: { ...common.dictionary, ...en.dictionary, ...fr.dictionary },
    });
    return (password: string, userInputs: string[] = []) => factory.check(password, userInputs);
  })();
  return loader;
}

export async function passwordScore(password: string, userInputs: string[] = []): Promise<number> {
  const check = await load();
  return check(password, userInputs).score;
}

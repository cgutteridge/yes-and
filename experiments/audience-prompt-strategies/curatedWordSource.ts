import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { WordSource } from "../../src/improv/audiencePrompt.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_WORD_BANK_PATH = path.join(HERE, "audienceWordBank.txt");

/**
 * The "curated bank" initial-plan.md §12A recommends as an alternative to treating
 * /usr/share/dict/words as a clean vocabulary: plain concrete nouns, verbs, occupations,
 * institutions, emotions, materials, and social situations, plus a pop-culture category
 * (characters, iconic objects, iconic settings). No proper nouns, abbreviations, archaic
 * spellings, or obscure inflections -- every entry should be instantly recognizable.
 *
 * Every pop-culture entry is a bare name, noun, or short noun phrase (e.g. "a lightsaber",
 * "Sherlock Holmes") -- never a quoted line of dialogue, lyric, or other excerpted expression.
 * Names, titles, and short phrases aren't copyrightable subject matter on their own (37 CFR
 * §202.1 excludes them), and referring to a trademarked thing by name to mean the actual
 * cultural thing -- not to brand this tool's own output, and not in a commercial product --
 * is nominative use, not infringement. See this folder's README for the fuller reasoning.
 *
 * Reads from a plain-text data file (one entry per line; blank lines and "#" comments are
 * ignored) rather than an inline array, mirroring how DictionaryWordSource reads
 * /usr/share/dict/words -- easier to hand-edit and extend without touching code.
 */
export class CuratedWordSource implements WordSource {
  constructor(private readonly path = DEFAULT_WORD_BANK_PATH) {}

  async loadWords(): Promise<string[]> {
    const content = await readFile(this.path, "utf8");
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  }
}

/**
 * Every entry that lives under a "# --- pop culture: ... ---" section header (films, novels,
 * classic lit/myth, modern icons, video games, reality TV, music, sports, internet, sitcom
 * tropes), lowercased for case-insensitive lookup. Used to detect, after a seed draw, whether a
 * pop-culture reference is actually available to lean into -- see popCultureSteer.ts. Reads the
 * same file as CuratedWordSource.loadWords() but tracks section headers to classify entries,
 * which the flat loadWords() deliberately doesn't need to do.
 */
export async function loadPopCultureEntries(path = DEFAULT_WORD_BANK_PATH): Promise<Set<string>> {
  const content = await readFile(path, "utf8");
  const entries = new Set<string>();
  let inPopCultureSection = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("# ---")) {
      inPopCultureSection = /pop culture/i.test(line);
      continue;
    }
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    if (inPopCultureSection) {
      entries.add(line.toLowerCase());
    }
  }

  return entries;
}

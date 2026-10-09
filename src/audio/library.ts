import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

/**
 * Licenses a track or effect may carry. "licensed" is a paid library (Epidemic Sound, Artlist): the
 * subscription covers it, so `sourceUrl` points at the track page and `credit` is usually null.
 */
export const AUDIO_LICENSES = ["cc0", "public-domain", "cc-by-4.0", "licensed", "original"] as const;

/** Licenses that need the credit line printed in every description that uses the track. */
const NEEDS_CREDIT = new Set(["cc-by-4.0"]);

export const MOODS = [
  "curious", "mysterious", "tense", "reflective", "somber", "warm", "uplifting", "old-world", "baroque", "driving",
] as const;

const Id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "ids are lowercase letters, digits and hyphens");
const File = z.string().regex(/^[A-Za-z0-9_][A-Za-z0-9._-]*$/, "a plain file name inside the library folder");

const Licensed = {
  license: z.enum(AUDIO_LICENSES),
  /** The page that states the license (or the track page for a paid library). */
  sourceUrl: z.url(),
  /** Credit line for descriptions, or null when the license asks for none. */
  credit: z.string().min(1).nullable(),
};

export const MusicTrackSchema = z
  .strictObject({
    id: Id,
    file: File,
    title: z.string().min(1),
    artist: z.string().min(1),
    moods: z.array(z.enum(MOODS)).min(1),
    bpm: z.number().positive().nullable(),
    /** What the bed suits, in a few words, for whoever picks one. */
    use: z.string().min(1),
    /** Extra gain on top of the library's common loudness, for taste. */
    gainDb: z.number().min(-12).max(6).default(0),
    ...Licensed,
  })
  .superRefine((t, ctx) => {
    if (NEEDS_CREDIT.has(t.license) && t.credit === null) {
      ctx.addIssue({ code: "custom", path: ["credit"], message: `${t.license} needs a credit line` });
    }
  });

export const SfxSchema = z.strictObject({
  id: Id,
  file: File,
  description: z.string().min(1),
  /** Default level in the mix, in dB relative to the file (files are peak-normalized to -3 dBFS). */
  gainDb: z.number().min(-40).max(0),
  ...Licensed,
});

export const MusicLibrarySchema = z.strictObject({
  /** Integrated loudness every bed is normalized to when it is added, so beds swap without re-mixing. */
  loudnessLufs: z.number(),
  tracks: z.array(MusicTrackSchema),
});
export const SfxLibrarySchema = z.strictObject({ sounds: z.array(SfxSchema) });

export type MusicTrack = z.output<typeof MusicTrackSchema>;
export type Sfx = z.output<typeof SfxSchema>;
export type MusicLibrary = z.output<typeof MusicLibrarySchema> & { dir: string };
export type SfxLibrary = z.output<typeof SfxLibrarySchema> & { dir: string };

function uniqueIds(items: readonly { id: string }[], what: string): void {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) throw new Error(`${what} id "${id}" appears twice`);
    seen.add(id);
  }
}

const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf-8"));

export function loadMusicLibrary(dir: string): MusicLibrary {
  const file = path.join(dir, "library.json");
  if (!fs.existsSync(file)) return { loudnessLufs: -20, tracks: [], dir };
  const lib = MusicLibrarySchema.parse(readJson(file));
  uniqueIds(lib.tracks, "Music track");
  return { ...lib, dir };
}

export function loadSfxLibrary(dir: string): SfxLibrary {
  const file = path.join(dir, "library.json");
  if (!fs.existsSync(file)) return { sounds: [], dir };
  const lib = SfxLibrarySchema.parse(readJson(file));
  uniqueIds(lib.sounds, "Sound effect");
  return { ...lib, dir };
}

export const findTrack = (lib: MusicLibrary, id: string): MusicTrack | undefined => lib.tracks.find((t) => t.id === id);

/** The description credit for a bed, or null when its license needs none. */
export const musicCredit = (track: MusicTrack | undefined): string | null => track?.credit ?? null;

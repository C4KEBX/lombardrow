import fs from "node:fs";
import path from "node:path";
import {
  MusicLibrarySchema, MusicTrackSchema, SfxLibrarySchema, SfxSchema, loadMusicLibrary, loadSfxLibrary,
} from "../src/audio/library";
import { prepareBed, prepareSfx } from "../src/audio/prepare";
import { parseFlags } from "../src/skill/flags";

const USAGE = `Usage:
  npm run audio -- list
  npm run audio -- add-music --src F --id ID --title T --artist A --moods m1,m2 --use "what it suits"
                             --license L --source-url URL [--credit "line"] [--bpm N] [--start SECONDS] [--gain DB]
  npm run audio -- add-sfx --src F --id ID --description D --gain DB --license L --source-url URL [--credit "line"]
Licenses: cc0, public-domain, cc-by-4.0, licensed (a paid library you subscribe to), original.`;

const MUSIC_DIR = path.resolve("music");
const SFX_DIR = path.resolve("sfx");
const writeJson = (file: string, data: unknown) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
const strip = <T extends { dir: string }>({ dir: _dir, ...rest }: T) => rest;

async function main(): Promise<void> {
  const [command, ...argv] = process.argv.slice(2);
  if (command === "list") {
    for (const t of loadMusicLibrary(MUSIC_DIR).tracks) {
      console.log(`${t.id.padEnd(22)} ${t.moods.join(", ").padEnd(28)} ${t.use}`);
    }
    console.log("");
    for (const s of loadSfxLibrary(SFX_DIR).sounds) console.log(`${s.id.padEnd(22)} ${String(s.gainDb).padEnd(5)} ${s.description}`);
    return;
  }
  const { values } = parseFlags(argv, {
    values: ["--src", "--id", "--title", "--artist", "--moods", "--use", "--license", "--source-url", "--credit", "--bpm", "--start", "--gain", "--description"],
  });
  const need = (flag: string): string => {
    const v = values.get(flag);
    if (v === undefined) throw new Error(`${flag} is required\n${USAGE}`);
    return v;
  };
  const src = path.resolve(need("--src"));
  if (!fs.existsSync(src)) throw new Error(`No file at ${src}`);
  const id = need("--id");
  const common = { license: need("--license"), sourceUrl: need("--source-url"), credit: values.get("--credit") ?? null };

  if (command === "add-music") {
    const lib = loadMusicLibrary(MUSIC_DIR);
    const track = MusicTrackSchema.parse({
      id, file: `${id}.mp3`, title: need("--title"), artist: need("--artist"),
      moods: need("--moods").split(",").map((m) => m.trim()),
      bpm: values.has("--bpm") ? Number(values.get("--bpm")) : null,
      use: need("--use"), gainDb: values.has("--gain") ? Number(values.get("--gain")) : 0, ...common,
    });
    await prepareBed(src, Number(values.get("--start") ?? 0), lib.loudnessLufs, path.join(MUSIC_DIR, track.file));
    const tracks = [...lib.tracks.filter((t) => t.id !== id), track];
    writeJson(path.join(MUSIC_DIR, "library.json"), MusicLibrarySchema.parse({ ...strip(lib), tracks }));
    console.log(`Added bed "${id}" (${lib.loudnessLufs} LUFS) to music/library.json`);
  } else if (command === "add-sfx") {
    const lib = loadSfxLibrary(SFX_DIR);
    const sound = SfxSchema.parse({ id, file: `${id}.mp3`, description: need("--description"), gainDb: Number(need("--gain")), ...common });
    fs.mkdirSync(SFX_DIR, { recursive: true });
    await prepareSfx(src, path.join(SFX_DIR, sound.file));
    const sounds = [...lib.sounds.filter((s) => s.id !== id), sound];
    writeJson(path.join(SFX_DIR, "library.json"), SfxLibrarySchema.parse({ sounds }));
    console.log(`Added sound "${id}" to sfx/library.json`);
  } else {
    throw new Error(USAGE);
  }
}

main().catch((error: Error) => {
  console.error(`audio failed: ${error.message}`);
  process.exit(1);
});

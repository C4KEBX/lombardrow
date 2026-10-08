import { runFfmpeg } from "../audio/mix";

/** Adds an audio track to an encoded video without re-encoding either stream. */
export async function muxVideoAudio(videoPath: string, audioPath: string, outPath: string): Promise<void> {
  await runFfmpeg([
    "-y", "-i", videoPath, "-i", audioPath,
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "copy",
    "-movflags", "+faststart", "-shortest", outPath,
  ]);
}

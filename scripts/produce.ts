import { parseArgs } from "../src/pipeline/cli";
import { produce } from "../src/pipeline/produce";

produce(parseArgs(process.argv.slice(2)))
  .then((r) => {
    console.log(`Done: ${r.videoPath}`);
    console.log(`Length ${(r.durationMs / 1000).toFixed(1)}s, ${r.totalFrames} frames, loudness ${r.loudness.inputI} LUFS`);
  })
  .catch((error: Error) => {
    console.error(`produce failed: ${error.message}`);
    process.exit(1);
  });

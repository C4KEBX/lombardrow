import { loadFont as loadBody } from "@remotion/google-fonts/Inter";
import { loadFont as loadDisplay } from "@remotion/google-fonts/ArchivoBlack";

export const DISPLAY_FONT = loadDisplay("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
export const BODY_FONT = loadBody("normal", { weights: ["600"], subsets: ["latin"] }).fontFamily;

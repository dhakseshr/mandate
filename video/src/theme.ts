// Writ's "Intaglio" identity, as used by the app (app/globals.css), for the film.
import { loadFont as loadBodoni } from "@remotion/google-fonts/BodoniModa";
import { loadFont as loadArchivo } from "@remotion/google-fonts/Archivo";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";

export const serif = loadBodoni("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;
loadBodoni("italic", { weights: ["400", "500"], subsets: ["latin"] });
export const sans = loadArchivo("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;

export const C = {
  bg: "#eeebe1",
  surface: "#f8f6ef",
  surface2: "#e6e2d6",
  line: "#d6d1c3",
  ink: "#121210",
  muted: "#55514a",
  allow: "#1d6a45",
  escalate: "#94560a",
  deny: "#b3261e",
  paypal: "#0059b8",
  navy: "#003087",
  night: "#0c0c0a",
  nightInk: "#ece7da",
  nightDeny: "#ff6f61",
};

export const FPS = 30;
export const W = 1920;
export const H = 1080;

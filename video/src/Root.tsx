import React from "react";
import { Composition } from "remotion";
import { FPS, H, W } from "./theme";
import { Film, FILM_FRAMES } from "./Film";

export const Root: React.FC = () => (
  <Composition id="Writ" component={Film} durationInFrames={FILM_FRAMES} fps={FPS} width={W} height={H} />
);

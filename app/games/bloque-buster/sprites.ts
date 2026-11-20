// Sprites de BLOQUE BUSTER, portados de references/started-games/04-arkanoid/assets/spritesheet.js.
// La carga de la imagen (antes con document.createElement) la hace el motor con `new Image()`.

import type { ColorBloque } from "./levels";

export interface Frame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export const SPRITESHEET_URL = "/games/bloque-buster/spritesheet-breakout.png";
export const BOUNCE_SOUND_URL = "/games/bloque-buster/ball-bounce.mp3";
export const BREAK_SOUND_URL = "/games/bloque-buster/break-sound.mp3";

function explosionRow(sy: number): Frame[] {
  return [256, 288, 320, 352].map((sx) => ({ sx, sy, sw: 32, sh: 16 }));
}

export const EXPLOSION_FRAMES: Record<ColorBloque, Frame[]> = {
  red: explosionRow(176),
  cyan: explosionRow(192),
  green: explosionRow(208),
  magenta: explosionRow(224),
  yellow: explosionRow(240),
  hotpink: explosionRow(256),
  gray: explosionRow(176), // como el original: el gris reutiliza los fotogramas del rojo
};

export const EXPLOSION_DURATION = 150; // ms

export const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 } as Frame,
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 } as Frame,
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  } as Record<ColorBloque, Frame>,
};

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  frame: Frame,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
}

export type NombreSprite = "paddle" | "ball" | `block_${ColorBloque}`;

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  name: NombreSprite,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const frame = name.startsWith("block_")
    ? SPRITES.blocks[name.slice(6) as ColorBloque]
    : SPRITES[name as "paddle" | "ball"];
  if (!frame) return;
  drawFrame(ctx, img, frame, x, y, w, h);
}

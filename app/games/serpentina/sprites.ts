// Recortes de frutas de SERPENTINA, tomados de references/source-assets/snake-assets/sprites.js
// (fila pixel-art de fruits.png, 3790×442). Los nombres del original no coinciden con la
// imagen (el recorte «banana» en x = 34 es una fruta roja), así que aquí solo hay índices.

export interface Recorte {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FRUITS_URL = "/games/serpentina/fruits.png";

const ROW_Y = 136;
const ROW_H = 160;

// [x, w] de cada fruta, en el orden de sprites.js.
const FRUIT_COLUMNS: [number, number][] = [
  [34, 110],
  [186, 150],
  [378, 110],
  [540, 130],
  [712, 130],
  [894, 110],
  [1066, 110],
  [1228, 130],
  [1400, 130],
  [1582, 110],
  [1734, 150],
  [1906, 150],
  [2068, 170],
  [2250, 140],
  [2432, 130],
  [2604, 130],
  [2786, 110],
  [2948, 130],
  [3110, 150],
  [3302, 110],
  [3454, 150],
  [3637, 130],
];

export const FRUIT_FRAMES: Recorte[] = FRUIT_COLUMNS.map(([x, w]) => ({
  x,
  y: ROW_Y,
  w,
  h: ROW_H,
}));

// Fruta del skin retro: manzana de píxel duro de un solo color (paleta limitada),
// en lugar del recorte a todo color del spritesheet.
export function drawFruitPixel(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  size: number,
) {
  const u = Math.floor(size / 8); // unidad de píxel
  const ox = x + Math.floor((size - u * 6) / 2);
  const oy = y + Math.floor((size - u * 7) / 2);
  ctx.fillStyle = color;
  ctx.fillRect(ox + 2 * u, oy, u, u); // tallo
  ctx.fillRect(ox + u, oy + u, 4 * u, u);
  ctx.fillRect(ox, oy + 2 * u, 6 * u, 3 * u);
  ctx.fillRect(ox + u, oy + 5 * u, 4 * u, 2 * u);
}

// Dibuja la fruta `index` ajustada dentro de una casilla cuadrada de `size` px con
// origen en (x, y), con 2 px de margen, conservando su proporción y centrada.
export function drawFruit(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  index: number,
  x: number,
  y: number,
  size: number,
) {
  const f = FRUIT_FRAMES[index];
  if (!f) return;
  const box = size - 4;
  const scale = Math.min(box / f.w, box / f.h);
  const dw = f.w * scale;
  const dh = f.h * scale;
  ctx.drawImage(
    img,
    f.x,
    f.y,
    f.w,
    f.h,
    x + (size - dw) / 2,
    y + (size - dh) / 2,
    dw,
    dh,
  );
}

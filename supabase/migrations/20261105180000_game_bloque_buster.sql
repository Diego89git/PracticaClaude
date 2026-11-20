-- SPEC 08: ficha de BLOQUE BUSTER (Arkanoid). Sustituye al placeholder local del mismo id.
-- Reutiliza la portada `cover-bricks` y el texto que ya tenía el placeholder.
insert into public.games (id, title, short, long, cat, cover, color) values (
  'bloque-buster',
  'BLOQUE BUSTER',
  'Rebota la pelota y destruye muros de neón.',
  'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?',
  'ARCADE',
  'cover-bricks',
  'cyan'
);

-- SPEC 07: ficha de CAÍDA (Tetris). Sustituye al placeholder local del mismo id.
-- Reutiliza la portada `cover-tetro` y el texto que ya tenía el placeholder.
insert into public.games (id, title, short, long, cat, cover, color) values (
  'caida',
  'CAÍDA',
  'Encaja las piezas antes de que el techo te aplaste.',
  'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.',
  'PUZZLE',
  'cover-tetro',
  'magenta'
);

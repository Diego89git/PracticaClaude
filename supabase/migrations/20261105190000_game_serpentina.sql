-- SPEC 09: ficha de SERPENTINA (Snake). Sustituye al placeholder local del mismo id.
-- Reutiliza la portada `cover-snake` y el texto que ya tenía el placeholder.
insert into public.games (id, title, short, long, cat, cover, color) values (
  'serpentina',
  'SERPENTINA',
  'Crece sin morder tu propia cola.',
  'Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.',
  'ARCADE',
  'cover-snake',
  'green'
);

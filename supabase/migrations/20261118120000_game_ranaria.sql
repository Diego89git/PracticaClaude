-- SPEC game-jam/frogger/01: ficha de FROGGER. Sustituye al placeholder local `ranaria`
-- (mismo id). Usa los textos de la spec, la portada nueva `cover-frogger` y el color
-- `green` (el check de games.color no admite `lime`, que pedía la spec).
insert into public.games (id, title, short, long, cat, cover, color) values (
  'ranaria',
  'FROGGER',
  'Cruza la carretera y el río sin convertirte en papilla.',
  'Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.',
  'ARCADE',
  'cover-frogger',
  'green'
);

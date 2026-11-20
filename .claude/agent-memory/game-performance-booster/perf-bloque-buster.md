---
name: perf-bloque-buster
description: Revisión de rendimiento de bloque-buster (Arkanoid): cifras Node antes/después, hallazgos y pendientes
metadata:
  type: project
---

Juego: bloque-buster. Sin skins. Medición solo Node (navegador lo midió la sesión principal: 32 FPS techo, 2.05 ms/fotograma, 7.39 ms con CPU 4x, 0 tareas largas, heap +0.13 MB).

Antes -> después (Node): llamadas ctx 60.9 -> 60.9 (drawImage x60 + fillRect); shadowBlur 0; font 0; heap/1000 fr 0.125 -> 0.117 MB; restarts +0.015 MB; 1 bucle; destroy limpio. ms/fotograma Node 0.0122 -> 0.0067 (orientativo, con carga).
Hash traza idéntico: af5492e9722f4e10fac7edae8df9d7f863c895a5ac69d238443c3da2287ba0f2.

Corregido (engine.ts): dibujo de bloques/paleta/pelota con drawFrame(SPRITES...) directo (antes drawSprite creaba plantilla `block_${color}` + startsWith/slice por bloque y fotograma); explosiones compactadas en sitio en vez de `.filter` por fotograma.

No corregido: 60 drawImage con escalado 32x16 -> 64x24 y suavizado; cachear bloques en OffscreenCanvas cambiaría el orden/aspecto del suavizado y los bloques mueren individualmente (riesgo visual, beneficio dudoso). playSound clona el Audio en cada rebote (solo en eventos, no por fotograma). Componente correcto (motor una vez, refs, emitChanges).

Pendiente: prueba en móvil real; medición «después» en navegador por la sesión principal.

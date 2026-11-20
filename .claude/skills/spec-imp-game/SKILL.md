---
name: spec-imp-game
description: Implementa una spec aprobada de un juego (igual que /spec-impl) y, al terminar, ejecuta en secuencia skin-designer y mobile-porte.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Read, Glob, Grep, Edit, Write, Agent, AskUserQuestion, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*)
---

# /spec-imp-game — Implementa un juego y lo remata con skins y móvil

Argumento recibido: `$ARGUMENTS`

Estado actual del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Configuración de ramas:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (por defecto, sin archivo de configuración)"`

---

## Fase A — Implementación (mismo flujo que /spec-impl)

No dupliques la lógica de `/spec-impl`: **lee `C:\Users\Administrador\.claude\skills\spec-impl\SKILL.md` y sigue sus 4 fases tal cual**, usando `$ARGUMENTS` como spec. Eso incluye validar que el estado sea "Aprobado", crear o cambiar a la rama `spec-NN-slug`, mostrar el resumen de la spec, pedir confirmación y avanzar paso a paso con pausas para revisar el diff. Respeta también sus reglas: no hacer commits, no improvisar ante ambigüedades y no salirse del alcance de la spec.

Ignora únicamente el mensaje final de "All steps of the plan are implemented" de ese skill: aquí se sustituye por la Fase B.

**Si la Fase A se detiene** (argumento vacío, spec no aprobada, cambios pendientes sin resolver, ambigüedad sin decidir o el usuario cancela), detente también aquí: **no lances ningún agente**.

## Fase B — Post-proceso con agentes (solo cuando todos los pasos del plan estén implementados)

Los dos agentes se ejecutan **uno después del otro, nunca en paralelo**: cada llamada a `Agent` va en su propio turno y no se emite la siguiente hasta recibir el resultado de la anterior.

1. Identifica el `id` del juego (el mismo que está en `JUEGOS_REALES` de `app/games/catalog.ts`, tomado de la spec).
2. Lanza el agente **`skin-designer`** indicándole únicamente ese juego. Espera a que termine y lee su resultado.
3. Solo entonces lanza el agente **`mobile-porte`** indicándole únicamente la pantalla `reproductor` (donde corre el juego y se muestran los controles táctiles). Espera su resultado.
4. Si el primer agente falla, se detiene o pide una aclaración, informa al usuario y **no lances el segundo** hasta que decida cómo seguir.

## Cierre

- Resume qué hizo cada agente (archivos tocados y hallazgos), indicando con claridad si algo no se pudo verificar.
- Recuerda verificar uno a uno los criterios de aceptación de la spec y, si pasan, que el usuario actualice su estado a "Implementado".
- **Git lo maneja el usuario:** Claude no hace `add` ni `commit`. Sugiere los comandos exactos con la lista de archivos modificados.

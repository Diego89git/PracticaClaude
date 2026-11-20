# Ejecución nocturna del agente game-jam (Arcade Vault).
# La lanza la tarea programada de Windows "ArcadeVault-GameJam" de lunes a viernes a las 2:00.
# Elige un tema nuevo, deja las specs en Borrador en specs/game-jam/<id>/ y escribe un log en
# %USERPROFILE%\.claude\logs\game-jam\. No toca código, Supabase ni Git. Sin notificaciones.
#
# Uso manual:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .claude\scripts\game-jam-nocturno.ps1          # ejecución real
#   powershell -NoProfile -ExecutionPolicy Bypass -File .claude\scripts\game-jam-nocturno.ps1 -Prueba  # solo comprueba la autenticación del CLI
param([switch]$Prueba)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$Proyecto = "C:\Users\Administrador\Desktop\ClaudeCode\05-arcade-vault"
$Claude = Join-Path $env:USERPROFILE ".local\bin\claude.exe"
$Modelo = "claude-sonnet-5-5"
$CarpetaLog = Join-Path $env:USERPROFILE ".claude\logs\game-jam"
New-Item -ItemType Directory -Force -Path $CarpetaLog | Out-Null
$Sufijo = if ($Prueba) { "_prueba" } else { "" }
$Log = Join-Path $CarpetaLog ((Get-Date -Format "yyyy-MM-dd_HHmm") + $Sufijo + ".log")

function Write-Log([string]$Texto) {
  $Texto | Out-File -FilePath $Log -Encoding utf8 -Append
}

# Una sola ejecución a la vez (además de MultipleInstances IgnoreNew en la tarea).
$Mutex = New-Object System.Threading.Mutex($false, "Global\ArcadeVaultGameJam")
if (-not $Mutex.WaitOne(0)) {
  Write-Log "$(Get-Date -Format s) Ya hay otra ejecución en marcha; esta se omite."
  exit 0
}

try {
  Set-Location $Proyecto
  Write-Log "$(Get-Date -Format s) Inicio ($(if ($Prueba) { 'prueba' } else { 'game-jam' })) en $Proyecto"

  if (-not (Test-Path $Claude)) {
    Write-Log "No se encuentra el CLI en $Claude"
    exit 1
  }

  if ($Prueba) {
    $Salida = & $Claude -p "Responde solo: OK" --model $Modelo 2>&1 | ForEach-Object { "$_" }
  } else {
    # Sin comillas dobles dentro del texto: PowerShell 5.1 las pasa mal a los ejecutables.
    $Prompt = @(
      "Ejecución nocturna automática: nadie puede responderte durante esta ejecución.",
      "Elige tú un tema de game jam nuevo. Antes, revisa las carpetas de specs/game-jam/ y la sección «Por qué existe esta spec» de cada una para no repetir temas ni mecánicas ya usadas.",
      "Escribe el tema en la primera línea de tu respuesta con el formato TEMA: <tema> y después trabaja con tus reglas habituales: specs en estado Borrador en specs/game-jam/<id>/, sin tocar código, Supabase ni Git.",
      "Termina con un resumen: id del juego, tema y archivos creados."
    ) -join " "

    $Salida = & $Claude -p $Prompt `
      --agent game-jam `
      --model $Modelo `
      --permission-mode acceptEdits `
      --allowedTools "Read" "Glob" "Grep" "Write" "Edit" "Bash(date:*)" "Bash(ls:*)" `
      --add-dir (Join-Path $env:USERPROFILE ".claude\skills\spec") `
      --output-format text 2>&1 | ForEach-Object { "$_" }
  }
  $Codigo = $LASTEXITCODE

  Write-Log "----- salida del CLI -----"
  Write-Log ($Salida -join [Environment]::NewLine)
  Write-Log "--------------------------"
  Write-Log "$(Get-Date -Format s) Fin. Código de salida: $Codigo"
  exit $Codigo
} finally {
  $Mutex.ReleaseMutex()
  $Mutex.Dispose()
}

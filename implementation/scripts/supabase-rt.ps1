$ErrorActionPreference = "Stop"

# The Codex host may inject a Supabase token belonging to another workspace.
# R&T deliberately uses the locally persisted Supabase CLI profile instead.
Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue

$ForwardedArguments = @($args | Where-Object { $_ -ne "--" })

$Pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if ($null -ne $Pnpm) {
  & $Pnpm.Source exec supabase @ForwardedArguments
  exit $LASTEXITCODE
}

$Corepack = Get-Command corepack -ErrorAction SilentlyContinue
if ($null -ne $Corepack) {
  & $Corepack.Source pnpm exec supabase @ForwardedArguments
  exit $LASTEXITCODE
}

throw "pnpm no está disponible. Instálalo mediante Corepack o agrégalo al PATH antes de ejecutar Supabase."

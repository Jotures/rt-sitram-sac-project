$ErrorActionPreference = "Stop"

# The Codex host may inject a Supabase token belonging to another workspace.
# R&T deliberately uses the locally persisted Supabase CLI profile instead.
Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue

$ForwardedArguments = @($args | Where-Object { $_ -ne "--" })

& pnpm exec supabase @ForwardedArguments
exit $LASTEXITCODE

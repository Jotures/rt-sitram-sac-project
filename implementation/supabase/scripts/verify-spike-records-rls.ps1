[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[^@\s]+@[^@\s]+\.[^@\s]+$")]
  [string]$UserAEmail,

  [Parameter(Mandatory = $true)]
  [Security.SecureString]$UserAPassword,

  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[^@\s]+@[^@\s]+\.[^@\s]+$")]
  [string]$UserBEmail,

  [Parameter(Mandatory = $true)]
  [Security.SecureString]$UserBPassword
)

$ErrorActionPreference = "Stop"

function Get-LocalSupabaseStatusLines {
  $statusLines = & pnpm exec supabase status --output env
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo leer el estado de Supabase local. Inicie el stack antes de validar RLS."
  }

  return $statusLines
}

function Get-StatusValue {
  param(
    [Parameter(Mandatory = $true)][string[]]$StatusLines,
    [Parameter(Mandatory = $true)][string]$Name
  )

  $match = $StatusLines | Where-Object { $_ -like "$Name=*" } | Select-Object -First 1
  if ($null -eq $match) {
    return $null
  }

  return $match.Substring($Name.Length + 1)
}

function Get-PlainPassword {
  param([Parameter(Mandatory = $true)][Security.SecureString]$Password)

  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Get-AccessToken {
  param(
    [Parameter(Mandatory = $true)][string]$Email,
    [Parameter(Mandatory = $true)][string]$Password,
    [Parameter(Mandatory = $true)][string]$PublishableKey
  )

  $body = @{ email = $Email; password = $Password } | ConvertTo-Json -Compress
  $session = Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:54321/auth/v1/token?grant_type=password" `
    -Headers @{ apikey = $PublishableKey } `
    -ContentType "application/json" `
    -Body $body

  return $session.access_token
}

$statusLines = Get-LocalSupabaseStatusLines
$publishableKey = Get-StatusValue -StatusLines $statusLines -Name "PUBLISHABLE_KEY"
if ([string]::IsNullOrWhiteSpace($publishableKey)) {
  $publishableKey = Get-StatusValue -StatusLines $statusLines -Name "ANON_KEY"
}
if ([string]::IsNullOrWhiteSpace($publishableKey)) {
  throw "Supabase local no devolviÃ³ una PUBLISHABLE_KEY ni ANON_KEY."
}

$userAPasswordText = Get-PlainPassword -Password $UserAPassword
$userBPasswordText = Get-PlainPassword -Password $UserBPassword
$userAToken = Get-AccessToken -Email $UserAEmail -Password $userAPasswordText -PublishableKey $publishableKey
$userBToken = Get-AccessToken -Email $UserBEmail -Password $userBPasswordText -PublishableKey $publishableKey
$userAHeaders = @{ apikey = $publishableKey; Authorization = "Bearer $userAToken"; Prefer = "return=representation" }
$userBHeaders = @{ apikey = $publishableKey; Authorization = "Bearer $userBToken" }

$createdRecord = Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:54321/rest/v1/spike_records" `
  -Headers $userAHeaders `
  -ContentType "application/json" `
  -Body (@{ value = "RLS technical spike verification" } | ConvertTo-Json -Compress)
$createdRecordId = @($createdRecord)[0].id

$visibleToUserB = Invoke-RestMethod `
  -Method Get `
  -Uri "http://127.0.0.1:54321/rest/v1/spike_records?id=eq.$createdRecordId" `
  -Headers $userBHeaders

if (@($visibleToUserB).Count -ne 0) {
  throw "RLS failure: User B read a technical spike record owned by User A."
}

Write-Output "RLS verificada: User A insertÃ³ y User B no pudo leer el registro experimental."

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[^@\s]+@[^@\s]+\.[^@\s]+$")]
  [string]$Email,

  [Parameter(Mandatory = $true)]
  [Security.SecureString]$Password
)

$ErrorActionPreference = "Stop"

function Get-LocalSupabaseStatusValue {
  param([Parameter(Mandatory = $true)][string]$Name)

  $statusLines = & pnpm exec supabase status --output env
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo leer el estado de Supabase local. Inicie el stack antes de crear el usuario."
  }

  $match = $statusLines | Where-Object { $_ -like "$Name=*" } | Select-Object -First 1
  if ($null -eq $match) {
    throw "Supabase local no devolviÃ³ $Name."
  }

  return $match.Substring($Name.Length + 1)
}

$serviceRoleKey = Get-LocalSupabaseStatusValue -Name "SERVICE_ROLE_KEY"
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)

try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $body = @{
    email = $Email
    password = $plainPassword
    email_confirm = $true
  } | ConvertTo-Json -Compress

  Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:54321/auth/v1/admin/users" `
    -Headers @{ apikey = $serviceRoleKey; Authorization = "Bearer $serviceRoleKey" } `
    -ContentType "application/json" `
    -Body $body | Out-Null

  Write-Output "Usuario tÃ©cnico local creado. La contraseÃ±a no se registrÃ³."
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}

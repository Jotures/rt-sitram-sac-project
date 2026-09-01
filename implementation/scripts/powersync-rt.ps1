$ErrorActionPreference = "Stop"

$ForwardedArguments = @($args | Where-Object { $_ -ne "--" })
$PreviousToken = $env:PS_ADMIN_TOKEN
$TokenPath = Join-Path ([Environment]::GetFolderPath("ApplicationData")) "RT-SITRAM\powersync-token.dpapi"

try {
  if (-not $env:PS_ADMIN_TOKEN) {
    if (-not (Test-Path -LiteralPath $TokenPath)) {
      throw "PowerSync access is not configured. Store the R&T token at $TokenPath."
    }

    $EncryptedToken = (Get-Content -LiteralPath $TokenPath -Raw).Trim()
    $SecureToken = ConvertTo-SecureString $EncryptedToken
    $Credential = [System.Management.Automation.PSCredential]::new("powersync", $SecureToken)
    $env:PS_ADMIN_TOKEN = $Credential.GetNetworkCredential().Password
  }

  & pnpm exec powersync @ForwardedArguments
  exit $LASTEXITCODE
}
finally {
  if ($null -eq $PreviousToken) {
    Remove-Item Env:PS_ADMIN_TOKEN -ErrorAction SilentlyContinue
  }
  else {
    $env:PS_ADMIN_TOKEN = $PreviousToken
  }
}

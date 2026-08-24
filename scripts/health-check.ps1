$ErrorActionPreference = "Stop"

$checks = @(
    @{ Name = "api-gateway"; Url = "http://localhost:3000/health" },
    @{ Name = "api-gateway-services"; Url = "http://localhost:3000/health/services" }
)

foreach ($check in $checks) {
    Write-Host "Checking $($check.Name): $($check.Url)"
    Invoke-WebRequest -UseBasicParsing -Uri $check.Url -TimeoutSec 10 | Out-Null
}

Write-Host "All health checks passed"

$ErrorActionPreference = "Stop"

$checks = @(
    @{ Name = "api-gateway"; Url = "http://localhost:3000/health" },
    @{ Name = "api-gateway-services"; Url = "http://localhost:3000/health/services" },
    @{ Name = "iam-service"; Url = "http://localhost:8081/health" },
    @{ Name = "project-service"; Url = "http://localhost:8082/health" },
    @{ Name = "issue-service"; Url = "http://localhost:8083/health" },
    @{ Name = "notification-service"; Url = "http://localhost:8084/health" }
)

foreach ($check in $checks) {
    Write-Host "Checking $($check.Name): $($check.Url)"
    Invoke-WebRequest -UseBasicParsing -Uri $check.Url -TimeoutSec 10 | Out-Null
}

Write-Host "All health checks passed"

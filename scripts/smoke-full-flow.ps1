param(
    [string]$GatewayUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$password = "Learning123!"
$ownerEmail = "owner-$suffix@example.com"
$memberEmail = "member-$suffix@example.com"
$projectKey = "S$($suffix.ToString().Substring($suffix.ToString().Length - 5))"
$curlPath = "curl.exe"
# Pipe JSON request bodies to curl as UTF-8 on both Windows PowerShell and pwsh.
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$temporaryFiles = [System.Collections.Generic.List[string]]::new()

function New-SmokeTempFile {
    $path = [System.IO.Path]::GetTempFileName()
    $temporaryFiles.Add($path)
    return $path
}

function Invoke-Gateway {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body,
        [string]$Token,
        [string]$CookieJar
    )
    $headers = @{ "x-correlation-id" = "smoke-$suffix" }
    if ($Token) { $headers.Authorization = "Bearer $Token" }
    $parameters = @{
        Method = $Method
        Uri = "$GatewayUrl$Path"
        Headers = $headers
        TimeoutSec = 15
    }
    if ($null -ne $Body) {
        $parameters.ContentType = "application/json"
        $parameters.Body = $Body | ConvertTo-Json -Depth 8
    }
    if ($CookieJar) {
        # curl, like browsers, supports Secure cookies on localhost. .NET's
        # CookieContainer drops them on local HTTP, so use an actual cookie jar.
        $curlArgs = @('--silent', '--show-error', '--fail-with-body', '--max-time', '15',
            '--request', $Method, '--cookie', $CookieJar, '--cookie-jar', $CookieJar,
            '--header', "x-correlation-id: smoke-$suffix")
        $json = if ($null -ne $Body) { $Body | ConvertTo-Json -Depth 8 }
        if ($null -ne $Body) { $curlArgs += @('--header', 'content-type: application/json', '--data-binary', '@-') }
        if ($Token) { $curlArgs += @('--header', "authorization: Bearer $Token") }
        $output = $json | & $curlPath @curlArgs "$GatewayUrl$Path"
        if ($LASTEXITCODE -ne 0) { throw "Cookie request $Method $Path failed: $output" }
        if ($output) { return ($output | ConvertFrom-Json) }
        return
    }
    Invoke-RestMethod @parameters
}

try {
Write-Host "1/10 Register owner and member"
$owner = Invoke-Gateway POST "/api/auth/register" @{ email = $ownerEmail; password = $password } ""
$member = Invoke-Gateway POST "/api/auth/register" @{ email = $memberEmail; password = $password } ""

Write-Host "2/10 Login both users"
$ownerJar = New-SmokeTempFile
$memberJar = New-SmokeTempFile
$ownerSession = Invoke-Gateway POST "/api/auth/login" @{ email = $ownerEmail; password = $password } "" $ownerJar
$memberSession = Invoke-Gateway POST "/api/auth/login" @{ email = $memberEmail; password = $password } "" $memberJar

Write-Host "3/10 Create workspace"
$workspaceResult = Invoke-Gateway POST "/api/workspaces" @{ name = "Smoke Workspace $suffix"; slug = "smoke-$suffix" } $ownerSession.accessToken
$workspaceId = $workspaceResult.workspace.id

Write-Host "4/10 Add member"
Invoke-Gateway POST "/api/workspaces/$workspaceId/members" @{ userId = $member.user.id; role = "MEMBER" } $ownerSession.accessToken | Out-Null

Write-Host "5/10 Create project"
$projectResult = Invoke-Gateway POST "/api/workspaces/$workspaceId/projects" @{ name = "Smoke Project $suffix"; key = $projectKey; description = "Full system smoke" } $ownerSession.accessToken
$projectId = $projectResult.project.id

Write-Host "6/10 Create assigned issue"
$issueResult = Invoke-Gateway POST "/api/projects/$projectId/issues" @{ summary = "Trace the full event flow"; type = "TASK"; priority = "HIGH"; assigneeUserId = $member.user.id } $ownerSession.accessToken
$issueId = $issueResult.issue.id

Write-Host "7/10 Transition and comment"
Invoke-Gateway POST "/api/issues/$issueId/transitions" @{ status = "IN_PROGRESS"; expectedVersion = $issueResult.issue.version } $ownerSession.accessToken | Out-Null
Invoke-Gateway POST "/api/issues/$issueId/comments" @{ body = "Member received the task." } $memberSession.accessToken | Out-Null

Write-Host "8/10 Verify history"
$history = Invoke-Gateway GET "/api/issues/$issueId/history" $null $ownerSession.accessToken
if ($history.items.Count -lt 3) { throw "Expected at least 3 history entries" }

Write-Host "9/10 Wait for Kafka notification"
$notifications = $null
for ($attempt = 0; $attempt -lt 10; $attempt++) {
    Start-Sleep -Seconds 2
    $notifications = Invoke-Gateway GET "/api/notifications" $null $memberSession.accessToken
    if ($notifications.items.Count -gt 0) { break }
}
if ($notifications.items.Count -eq 0) { throw "No notification arrived through Kafka" }

Write-Host "10/10 Mark notification read and rotate session"
Invoke-Gateway PATCH "/api/notifications/$($notifications.items[0].id)/read" $null $memberSession.accessToken | Out-Null
$rotated = Invoke-Gateway POST "/api/auth/refresh" $null "" $ownerJar
if (-not $rotated.accessToken) { throw "Refresh token rotation failed" }

$revokedJar = New-SmokeTempFile
Copy-Item -LiteralPath $ownerJar -Destination $revokedJar
Invoke-Gateway POST "/api/auth/logout" $null "" $ownerJar | Out-Null
$replayBody = New-SmokeTempFile
$replayStatus = & $curlPath --silent --show-error --max-time 15 --request POST --cookie $revokedJar --output $replayBody --write-out '%{http_code}' "$GatewayUrl/api/auth/refresh"
if ($LASTEXITCODE -ne 0 -or $replayStatus -ne '401') { throw "Logged-out refresh token was not revoked" }
if ((Get-Content -LiteralPath $replayBody -Raw | ConvertFrom-Json).code -ne "INVALID_REFRESH_TOKEN") { throw "Unexpected logout replay response" }

Write-Host "Full synchronous + asynchronous smoke flow passed" -ForegroundColor Green
Write-Host "workspace=$workspaceId project=$projectId issue=$issueId correlation=smoke-$suffix"
} finally {
    foreach ($path in $temporaryFiles) { Remove-Item -LiteralPath $path -ErrorAction SilentlyContinue }
}

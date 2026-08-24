[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CgcArguments
)

$toolPath = Join-Path $env:USERPROFILE '.codex\tools\codegraphcontext\Scripts\cgc.exe'

if (-not (Test-Path -LiteralPath $toolPath)) {
    throw "CodeGraphContext is not installed at $toolPath. Reinstall it in the local Codex tools environment."
}

$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'

& $toolPath @CgcArguments
exit $LASTEXITCODE

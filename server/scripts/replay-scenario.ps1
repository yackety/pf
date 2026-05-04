param(
    [Parameter(Mandatory = $true)]
    [string]$ConfigPath,
    [string]$BaseUrl = 'http://127.0.0.1:11000'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-AgentPost {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][hashtable]$Body
    )

    $uri = "$BaseUrl$Path"
    $json = $Body | ConvertTo-Json -Depth 20
    return Invoke-RestMethod -Method Post -Uri $uri -ContentType 'application/json' -Body $json
}

function Invoke-AutomateStep {
    param(
        [Parameter(Mandatory = $true)][string]$Udid,
        [Parameter(Mandatory = $true)]$Step
    )

    $resp = Invoke-AgentPost -Path '/api/goog/device/automate' -Body @{
        udid = $Udid
        steps = @($Step)
    }

    if (-not $resp.success) {
        $first = $resp.results | Select-Object -First 1
        $err = if ($null -ne $first -and $first.error) { [string]$first.error } else { 'Automation step failed' }
        throw $err
    }
}

function Wait-ForShell {
    param(
        [Parameter(Mandatory = $true)][string]$Udid,
        [Parameter(Mandatory = $true)][string]$Command,
        [string]$Contains,
        [string]$Equals,
        [string]$Regex,
        [int]$TimeoutMs = 15000,
        [int]$IntervalMs = 500
    )

    $started = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

    while ($true) {
        $resp = Invoke-AgentPost -Path '/api/goog/device/shell' -Body @{
            udid = $Udid
            command = $Command
        }

        $output = [string]($resp.output)
        $ok = $false

        if ($Equals) {
            $ok = $output.Trim() -eq $Equals
        } elseif ($Contains) {
            $ok = $output -like "*$Contains*"
        } elseif ($Regex) {
            $ok = $output -match $Regex
        } else {
            throw 'wait-for-shell requires one of: equals, contains, regex'
        }

        if ($ok) {
            return
        }

        $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        if (($now - $started) -ge $TimeoutMs) {
            throw "wait-for-shell timed out after ${TimeoutMs}ms. Last output: $output"
        }

        Start-Sleep -Milliseconds $IntervalMs
    }
}

function Get-IntOrDefault {
    param(
        [Parameter(Mandatory = $false)]$Value,
        [Parameter(Mandatory = $true)][int]$Default
    )

    if ($null -eq $Value) {
        return $Default
    }

    try {
        return [int]$Value
    } catch {
        return $Default
    }
}

function Read-ScenarioConfig {
    param(
        [Parameter(Mandatory = $true)][string]$Path
    )

    $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    $raw = Get-Content -LiteralPath $Path -Raw

    if ($ext -eq '.json') {
        return $raw | ConvertFrom-Json
    }

    if ($ext -eq '.yml' -or $ext -eq '.yaml') {
        $yamlParser = Get-Command -Name ConvertFrom-Yaml -ErrorAction SilentlyContinue
        if ($null -eq $yamlParser) {
            throw 'YAML config requires ConvertFrom-Yaml. Use PowerShell 7+, install powershell-yaml module, or use a .json config file.'
        }
        return $raw | ConvertFrom-Yaml
    }

    throw 'Unsupported config extension. Use .json, .yml, or .yaml'
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Config file not found: $ConfigPath"
}

$config = Read-ScenarioConfig -Path $ConfigPath

$scenario = [string]$config.scenario
$session = [string]$config.session
$recordId = [string]$config.recordId
$udid = [string]$config.udid
$preSteps = @()
if ($null -ne $config.preSteps) {
    $preSteps = @($config.preSteps)
}

if ([string]::IsNullOrWhiteSpace($scenario)) {
    throw 'Config must include non-empty "scenario"'
}
if ([string]::IsNullOrWhiteSpace($session)) {
    throw 'Config must include non-empty "session"'
}
if ([string]::IsNullOrWhiteSpace($recordId)) {
    throw 'Config must include non-empty "recordId"'
}

Write-Host "Scenario: $scenario"
Write-Host "Session : $session"
Write-Host "Record  : $recordId"

if ($preSteps.Count -gt 0 -and [string]::IsNullOrWhiteSpace($udid)) {
    throw 'Config must include "udid" when preSteps are provided'
}

foreach ($step in $preSteps) {
    $type = [string]$step.type
    if ([string]::IsNullOrWhiteSpace($type)) {
        throw 'Every preStep must include "type"'
    }

    Write-Host "Running pre-step: $type"

    if ($type -eq 'wait-for-shell') {
        $timeoutMs = Get-IntOrDefault -Value $step.timeoutMs -Default 15000
        $intervalMs = Get-IntOrDefault -Value $step.intervalMs -Default 500
        Wait-ForShell -Udid $udid -Command ([string]$step.command) -Contains ([string]$step.contains) -Equals ([string]$step.equals) -Regex ([string]$step.regex) -TimeoutMs $timeoutMs -IntervalMs $intervalMs
        continue
    }

    Invoke-AutomateStep -Udid $udid -Step $step
}

Write-Host 'Running recording replay...'
$runResp = Invoke-AgentPost -Path '/api/recordings/run' -Body @{
    session = $session
    recordId = $recordId
}

if (-not $runResp.success) {
    throw 'Replay failed'
}

Write-Host 'Replay started successfully.'

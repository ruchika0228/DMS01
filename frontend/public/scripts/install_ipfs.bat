<# :
@echo off
title IPFS Auto-Installer

:: 1. Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrative privileges...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: 2. Run the PowerShell portion of this exact file with bypassed execution policy
echo Running IPFS Setup...
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex (Get-Content '%~f0' -Raw)"

:: Exit the batch script once PowerShell finishes
exit /b
#>

# ==============================================================================
# POWERSHELL SCRIPT STARTS HERE (Windows ignores this part until PowerShell runs)
# ==============================================================================

# 1. Variables & Security
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$url = "https://dist.ipfs.tech/kubo/v0.39.0/kubo_v0.39.0_windows-amd64.zip"
$zipFile = "$env:TEMP\kubo.zip"
$destFolder = "C:\kubo"
$binPath = "$destFolder\ipfs.exe"
$userRepo = "$env:USERPROFILE\.ipfs"

# 2. Set Permanent IPFS_PATH Environment Variable
[Environment]::SetEnvironmentVariable("IPFS_PATH", $userRepo, "Machine")
$env:IPFS_PATH = $userRepo

# 3. Download & Install
if (-not (Test-Path $destFolder)) { New-Item -ItemType Directory -Path $destFolder | Out-Null }
Write-Host "Downloading Kubo..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $url -OutFile $zipFile
Expand-Archive -Path $zipFile -DestinationPath "$env:TEMP\kubo_extracted" -Force
Move-Item -Path "$env:TEMP\kubo_extracted\kubo\*" -Destination $destFolder -Force

# 4. Initialize & Configuration (CORS & API)
if (-not (Test-Path $userRepo)) { & $binPath init }

Write-Host "Applying API and CORS settings..." -ForegroundColor Cyan
# Set API Address
& $binPath config Addresses.API /ip4/127.0.0.1/tcp/5001

# Set CORS configurations
& $binPath config --json API.HTTPHeaders.Access-Control-Allow-Origin '[\"*\"]'
& $binPath config --json API.HTTPHeaders.Access-Control-Allow-Methods '[\"PUT\", \"POST\", \"GET\"]'

# 5. Create the Invisible Scheduled Task
Write-Host "Creating Invisible Startup Task..." -ForegroundColor Magenta
$taskName = "IPFS_Daemon"
$action = New-ScheduledTaskAction -Execute $binPath -Argument "daemon"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force

# 6. Start it now (Hidden)
Start-ScheduledTask -TaskName $taskName

Write-Host "`nDONE! IPFS is now running invisibly as a System Service." -ForegroundColor Black -BackgroundColor Green

# Keep the window open so the user can see the success message
Read-Host "`nPress Enter to close this window..."

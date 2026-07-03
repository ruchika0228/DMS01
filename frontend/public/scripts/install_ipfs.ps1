# 1. Variables & Security
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$url = "https://dist.ipfs.tech/kubo/v0.39.0/kubo_v0.39.0_windows-amd64.zip"
$zipFile = "$env:TEMP\kubo.zip"
$destFolder = "C:\kubo"
$binPath = "$destFolder\ipfs.exe"
$userRepo = "$env:USERPROFILE\.ipfs"

# 2. Set Permanent IPFS_PATH Environment Variable
# This ensures the SYSTEM account uses YOUR user's IPFS folder/identity.
[Environment]::SetEnvironmentVariable("IPFS_PATH", $userRepo, "Machine")
$env:IPFS_PATH = $userRepo

# 3. Download & Install
if (-not (Test-Path $destFolder)) { New-Item -ItemType Directory -Path $destFolder | Out-Null }
Write-Host "Downloading Kubo..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $url -OutFile $zipFile
Expand-Archive -Path $zipFile -DestinationPath "$env:TEMP\kubo_extracted" -Force
Move-Item -Path "$env:TEMP\kubo_extracted\kubo\*" -Destination $destFolder -Force

# 4. Initialize & CORS Configuration
if (-not (Test-Path $userRepo)) { & $binPath init }
Write-Host "Applying CORS settings..." -ForegroundColor Cyan
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

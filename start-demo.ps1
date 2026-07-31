# ============================================================
#  Start the ATS demo — production server + public link.
#  Use this if the link stops, or after a restart/reboot.
#
#  How to run:
#    1. Right-click this file -> "Run with PowerShell"
#       (or in PowerShell:  ./start-demo.ps1 )
#    2. KEEP THE WINDOW THAT OPENS OPEN. It prints a public
#       link like https://something.trycloudflare.com
#    3. Share that link + the signup code with HR.
#
#  Keep the laptop plugged in and switched on. Sleep is already
#  disabled. Closing the windows or shutting down stops the link.
# ============================================================

$app = "C:\Users\MUKHUNTH\Desktop\ATS TRACKING SOFTWARE\ats"
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
Set-Location $app

Write-Host "Freeing port 3000 and any old tunnel..." -ForegroundColor Cyan
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Starting the app (production) in its own window..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit','-Command',"Set-Location `"$app`"; npm start"

Write-Host "Waiting for the app to come up on http://localhost:3000 ..." -ForegroundColor Cyan
do {
  Start-Sleep -Seconds 2
  $up = $false
  try { $up = (Invoke-WebRequest "http://localhost:3000/login" -TimeoutSec 3 -UseBasicParsing).StatusCode -eq 200 } catch { $up = $false }
} until ($up)

Write-Host ""
Write-Host "App is up. Opening the public link below." -ForegroundColor Green
Write-Host "KEEP THIS WINDOW OPEN while HR is using it." -ForegroundColor Yellow
Write-Host "Signup code to share: hirebase-demo" -ForegroundColor Yellow
Write-Host ""

& $cloudflared tunnel --url http://localhost:3000

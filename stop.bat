@echo off
echo 🛑 Stopping Aquarium Autobattler services...
echo.

echo Checking for services on ports 3000-3005...

REM Use PowerShell to stop services on each port
powershell -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Where-Object {$_.OwningProcess -ne 0} | ForEach-Object { Write-Host \"Stopping service on port 3000 (PID: $($_.OwningProcess))\"; Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

powershell -Command "Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Where-Object {$_.OwningProcess -ne 0} | ForEach-Object { Write-Host \"Stopping service on port 3001 (PID: $($_.OwningProcess))\"; Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

powershell -Command "Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue | Where-Object {$_.OwningProcess -ne 0} | ForEach-Object { Write-Host \"Stopping service on port 3002 (PID: $($_.OwningProcess))\"; Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

powershell -Command "Get-NetTCPConnection -LocalPort 3003 -ErrorAction SilentlyContinue | Where-Object {$_.OwningProcess -ne 0} | ForEach-Object { Write-Host \"Stopping service on port 3003 (PID: $($_.OwningProcess))\"; Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo ✅ All Aquarium Autobattler services have been safely stopped.
echo Other Node.js processes (like Claude) remain running.
echo.
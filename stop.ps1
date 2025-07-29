Write-Host "Stopping Aquarium Autobattler services..." -ForegroundColor Red
Write-Host ""

# Kill processes on port 3000
Write-Host "Stopping processes on port 3000..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object {
    $processId = $_.OwningProcess
    Write-Host "  Killing PID: $processId" -ForegroundColor Cyan
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

# Kill processes on port 3001
Write-Host "Stopping processes on port 3001..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object {
    $processId = $_.OwningProcess
    Write-Host "  Killing PID: $processId" -ForegroundColor Cyan
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "All services stopped!" -ForegroundColor Green
Write-Host "Claude and other Node processes remain safe." -ForegroundColor Blue
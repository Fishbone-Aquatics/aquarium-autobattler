Write-Host "Starting Aquarium Autobattler..." -ForegroundColor Green
Write-Host ""

# Get local IP address
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254.*"} | Select-Object -First 1).IPAddress

Write-Host "Access the game at:" -ForegroundColor Cyan
Write-Host "  Local:    http://localhost:3000" -ForegroundColor Yellow
if ($localIP) {
    Write-Host "  Network:  http://${localIP}:3000" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Backend API:" -ForegroundColor Cyan
Write-Host "  Local:    http://localhost:3001" -ForegroundColor Yellow
if ($localIP) {
    Write-Host "  Network:  http://${localIP}:3001" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Starting development servers..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

# Run npm run dev
npm run dev
@echo off
echo 🐠 Starting Aquarium Autobattler...
echo.

echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo 🏗️ Building shared types...
call npx nx build shared-types
if %errorlevel% neq 0 (
    echo ❌ Failed to build shared types
    pause
    exit /b 1
)

echo.
echo 🚀 Starting services...
echo 📱 Frontend will be available at: http://localhost:3000
echo 🔧 Game Engine will be available at: http://localhost:3001
echo.
echo Press Ctrl+C to stop all services
echo.

REM Start both services in parallel
start "Game Engine" cmd /k "echo 🔧 Starting Game Engine... && npx nx serve game-engine"
timeout /t 3 /nobreak > nul
start "Frontend" cmd /k "echo 📱 Starting Frontend... && npx nx serve frontend"

echo ✅ Both services are starting up...
echo 🌐 Opening browser to http://localhost:3000 in 10 seconds...
timeout /t 10 /nobreak > nul
start http://localhost:3000

echo.
echo Services are running! Press any key to stop all services.
pause > nul

echo.
echo 🛑 Stopping services...
taskkill /f /im node.exe /t > nul 2>&1
echo ✅ All services stopped.
pause
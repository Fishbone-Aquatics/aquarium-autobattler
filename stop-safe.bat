@echo off
echo 🛑 Safely stopping Aquarium Autobattler services...
echo.

echo Stopping services on ports 3000-3003...

REM Find and kill processes on specific ports
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
    echo Stopping process on port 3000 (PID: %%a)
    taskkill /PID %%a /F > nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001.*LISTENING"') do (
    echo Stopping process on port 3001 (PID: %%a)
    taskkill /PID %%a /F > nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002.*LISTENING"') do (
    echo Stopping process on port 3002 (PID: %%a)
    taskkill /PID %%a /F > nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3003.*LISTENING"') do (
    echo Stopping process on port 3003 (PID: %%a)
    taskkill /PID %%a /F > nul 2>&1
)

echo.
echo ✅ All Aquarium Autobattler services have been safely stopped.
echo Claude and other Node.js processes remain running.
echo.
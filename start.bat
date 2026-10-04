@echo off
REM INFLUX - double-click to start on Windows.
title INFLUX
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed. Download the LTS version from https://nodejs.org
  echo   then double-click start.bat again.
  echo.
  pause
  exit /b 1
)

if not exist "backend\node_modules" (
  echo   Installing INFLUX for the first time. This takes a minute...
  call npm install --prefix backend
  if errorlevel 1 ( echo. & echo   Install failed. See the messages above. & pause & exit /b 1 )
)

REM Open the browser a few seconds after the server starts
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"
call npm start --prefix backend
pause

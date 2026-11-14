@echo off
setlocal
cd /d "%~dp0"
title TikTok LIVE Boxing Arena
set "PORT=8766"
where py >nul 2>nul
if %errorlevel%==0 (
  set "PYTHON=py -3"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python 3 was not found.
    echo Install Python from https://www.python.org/downloads/ and enable Add Python to PATH.
    pause
    exit /b 1
  )
  set "PYTHON=python"
)
echo Starting TikTok LIVE Boxing at http://127.0.0.1:%PORT%
start "" "http://127.0.0.1:%PORT%/index.html"
%PYTHON% server.py --port %PORT%
echo.
echo Server stopped. If the port was already in use, close the other server and try again.
pause


@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动 localtrain ...
set PORT=3008
npm run dev
pause

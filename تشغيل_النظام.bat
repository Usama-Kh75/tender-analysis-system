@echo off
chcp 65001 > nul
setlocal
title نظام تحليل العطاءات والمناقصات الذكي

rem يفتح النظام في نافذة تطبيق مستقلة (بدون شريط المتصفح) عبر وضع --app في Edge/Chrome.
rem لا يُستخدم --user-data-dir عمداً: نفس ملف تعريف المتصفح = نفس بيانات localStorage المحفوظة سابقاً.

set "APPFILE=%~dp0نظام_تحليل_العطاءات.html"
set "APPURL=file:///%APPFILE:\=/%"

set "EDGE="
for %%P in ("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" "%LocalAppData%\Microsoft\Edge\Application\msedge.exe") do if not defined EDGE if exist %%P set "EDGE=%%~P"

set "CHROME="
for %%P in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe") do if not defined CHROME if exist %%P set "CHROME=%%~P"

rem إذا كان Chrome هو المتصفح الافتراضي لملفات HTML نستخدمه، لأن بيانات المشاريع المحفوظة موجودة فيه.
set "PREFER_CHROME="
reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.html\UserChoice" /v ProgId 2>nul | find /i "ChromeHTML" > nul && set "PREFER_CHROME=1"

if defined PREFER_CHROME if defined CHROME goto :chrome
if defined EDGE goto :edge
if defined CHROME goto :chrome

rem لا يوجد Edge ولا Chrome: فتح عادي في المتصفح الافتراضي.
start "" "%APPFILE%"
exit /b

:edge
start "" "%EDGE%" --app="%APPURL%" --start-maximized
exit /b

:chrome
start "" "%CHROME%" --app="%APPURL%" --start-maximized
exit /b

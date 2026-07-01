@echo off
setlocal enabledelayedexpansion

echo ================================================
echo   SagaSpun Git History Squash
echo ================================================
echo.

REM --- Step 1: Confirm we're in the right repo ---
git remote -v > temp_remote_check.txt 2>&1
findstr /C:"SagaSpun---AI-Dungeon-Master" temp_remote_check.txt >nul
if errorlevel 1 (
    echo ERROR: This does not look like the SagaSpun repo folder.
    echo Current remote is:
    type temp_remote_check.txt
    del temp_remote_check.txt
    echo.
    echo Move this .bat file into your SagaSpun repo folder and try again.
    pause
    exit /b 1
)
del temp_remote_check.txt
echo [OK] Confirmed this is the SagaSpun repo.
echo.

REM --- Step 2: Create orphan branch and re-stage everything ---
echo Creating clean orphan branch...
git checkout --orphan clean-main
if errorlevel 1 (
    echo ERROR: git checkout --orphan failed. Stopping.
    pause
    exit /b 1
)

echo Removing all files from git tracking (keeps them on disk)...
git rm -r --cached . >nul

echo Re-adding files, respecting .gitignore...
git add .
echo.

REM --- Step 3: Show what's about to be committed for review ---
echo ================================================
echo   REVIEW BEFORE CONTINUING
echo ================================================
echo The following files are staged to be committed:
echo (Check carefully: node_modules and saga_spun.db should NOT appear below)
echo.
git status
echo.
echo ================================================
echo If you see node_modules or saga_spun.db listed above,
echo press Ctrl+C now to STOP and fix your .gitignore first.
echo.
echo If everything looks correct, press any key to commit and push.
echo ================================================
pause

REM --- Step 4: Commit, replace main, push ---
git commit -m "AI Dungeon Master for D&D - React Native/Expo + Flask"
if errorlevel 1 (
    echo ERROR: Commit failed ^(possibly nothing was staged^). Stopping.
    pause
    exit /b 1
)

git branch -D main
git branch -m main

echo.
echo About to force-push the cleaned history to GitHub.
echo This will permanently replace the old history on the remote.
echo Press any key to push, or Ctrl+C to cancel.
pause

git push -f origin main

echo.
echo ================================================
echo Done. Check the output above for a line like:
echo   + xxxxxxx...xxxxxxx main -^> main ^(forced update^)
echo That confirms the push succeeded.
echo ================================================
pause

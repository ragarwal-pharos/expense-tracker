@echo off
echo Starting deployment with cache busting...

REM Build the application
echo Building application...
ng build --configuration=production

REM Clear any existing service worker caches
echo Clearing service worker caches...
if exist "dist\expense-tracker\ngsw.json" del "dist\expense-tracker\ngsw.json"
if exist "dist\expense-tracker\ngsw-worker.js" del "dist\expense-tracker\ngsw-worker.js"

REM Deploy to Firebase
echo Deploying to Firebase...
firebase deploy --only hosting

echo Deployment completed with cache busting!
echo Your application should now load the latest version without requiring a manual refresh.
pause

@echo off
echo 🔥 Firebase Deployment Script
echo ============================

echo.
echo 📋 Step 1: Checking Firebase CLI...
firebase --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Firebase CLI not found. Installing...
    npm install -g firebase-tools
    if %errorlevel% neq 0 (
        echo ❌ Failed to install Firebase CLI
        pause
        exit /b 1
    )
) else (
    echo ✅ Firebase CLI found
)

echo.
echo 📋 Step 2: Checking Firebase login...
firebase projects:list >nul 2>&1
if %errorlevel% neq 0 (
    echo 🔐 Please login to Firebase...
    firebase login
    if %errorlevel% neq 0 (
        echo ❌ Firebase login failed
        pause
        exit /b 1
    )
) else (
    echo ✅ Already logged in to Firebase
)

echo.
echo 📋 Step 3: Building application...
echo 🔨 Running: ng build --configuration production
ng build --configuration production
if %errorlevel% neq 0 (
    echo ❌ Build failed! Please check for errors.
    pause
    exit /b 1
)
echo ✅ Build successful!

echo.
echo 📋 Step 4: Deploying to Firebase...
echo 🚀 Running: firebase deploy --only hosting
firebase deploy --only hosting
if %errorlevel% equ 0 (
    echo.
    echo 🎉 Deployment successful!
    echo 📱 Your expense tracker is now live!
    echo.
    echo 📋 Next steps:
    echo 1. Open the deployed URL on your mobile device
    echo 2. Add to Home Screen for app-like experience
    echo 3. Test offline functionality
    echo 4. Check Firebase Console for data
) else (
    echo ❌ Deployment failed! Please check your Firebase configuration.
)

echo.
pause 
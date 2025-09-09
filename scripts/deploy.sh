#!/bin/bash

# Deployment helper script for Paras
# Usage: ./scripts/deploy.sh [web|functions|android|ios|all]

set -e

TARGET=${1:-web}
BRANCH=$(git branch --show-current)

echo "🚀 Starting deployment for target: $TARGET"
echo "📍 Current branch: $BRANCH"

# Validate branch for production deployments
if [ "$BRANCH" = "master" ]; then
    echo "✅ Production deployment from master branch"
elif [ "$BRANCH" = "dev" ]; then
    echo "🔄 Development deployment from dev branch"
else
    echo "⚠️  Warning: Deploying from non-standard branch: $BRANCH"
fi

# Run quality checks first
echo "🔍 Running quality checks..."
npm run type-check
npm run lint:check
npm run format:check
npm run test

case $TARGET in
    "web")
        echo "🌐 Deploying web application..."
        npm run build
        firebase deploy --only hosting
        ;;
    
    "functions")
        echo "⚡ Deploying Firebase Functions..."
        cd functions
        npm run build
        npm run deploy
        cd ..
        ;;
    
    "android")
        echo "🤖 Building Android application..."
        npm run build:android
        cd android
        ./gradlew assembleDebug
        if [ "$BRANCH" = "master" ]; then
            echo "📱 Building release AAB for production..."
            ./gradlew bundleRelease
        fi
        cd ..
        ;;
    
    "ios")
        echo "🍎 Building iOS application..."
        npm run build:ios
        cd ios/App
        pod install
        xcodebuild -workspace App.xcworkspace \
                   -scheme App \
                   -configuration Debug \
                   -destination 'generic/platform=iOS Simulator' \
                   clean build
        cd ../..
        ;;
    
    "all")
        echo "🚀 Full deployment - all targets..."
        ./scripts/deploy.sh web
        ./scripts/deploy.sh functions
        ./scripts/deploy.sh android
        ./scripts/deploy.sh ios
        ;;
    
    *)
        echo "❌ Invalid target: $TARGET"
        echo "Valid targets: web, functions, android, ios, all"
        exit 1
        ;;
esac

echo "✅ Deployment completed successfully for target: $TARGET"

# 🚀 Deployment Guide

This document outlines the complete deployment setup for the Paras application using GitHub Actions.

## 📋 Overview

The deployment pipeline supports multiple targets:

- **Web**: Firebase Hosting deployment
- **Functions**: Firebase Functions deployment
- **Android**: APK/AAB builds
- **iOS**: iOS app builds
- **Quality Checks**: Linting, testing, type checking

## 🔧 Required Secrets

To use this deployment workflow, you need to configure the following secrets in your GitHub repository:

### Firebase Secrets

```bash
# For Firebase authentication (choose one method)
FIREBASE_SERVICE_ACCOUNT_PARAS_293D5  # Service account key (recommended)
# OR
FIREBASE_TOKEN                        # Firebase CLI token
```

### Android Secrets (for release builds)

```bash
ANDROID_KEYSTORE_FILE      # Base64 encoded keystore file
ANDROID_KEYSTORE_PASSWORD  # Keystore password
ANDROID_KEY_ALIAS          # Key alias
ANDROID_KEY_PASSWORD       # Key password
```

### Optional Secrets

```bash
CODECOV_TOKEN             # For code coverage reporting
SLACK_WEBHOOK_URL         # For deployment notifications
```

## 🔑 Setting Up Secrets

### 1. Firebase Authentication

#### Method A: Service Account (Recommended)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project → Settings → Service Accounts
3. Click "Generate new private key"
4. Save the JSON file and encode it in base64:
   ```bash
   base64 -i path/to/service-account.json
   ```
5. Add as `FIREBASE_SERVICE_ACCOUNT_PARAS_293D5` secret

#### Method B: Firebase Token

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login:ci`
3. Copy the token and add as `FIREBASE_TOKEN` secret

### 2. Android Keystore Setup

```bash
# Generate keystore (if you don't have one)
keytool -genkey -v -keystore android-release-key.keystore \
  -alias release -keyalg RSA -keysize 2048 -validity 10000

# Encode keystore to base64
base64 -i android-release-key.keystore

# Add the base64 string as ANDROID_KEYSTORE_FILE secret
```

### 3. Adding Secrets to GitHub

1. Go to your repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret with the exact names listed above

## 🎯 Deployment Triggers

### Automatic Deployments

#### Production (master branch)

- **Push to master**: Deploys web + functions
- **Commit with `[android]`**: Also builds Android
- **Commit with `[ios]`**: Also builds iOS

#### Development (dev branch)

- **Push to dev**: Runs quality checks only
- **Pull request**: Runs quality checks + preview deploy

### Manual Deployments

Use GitHub Actions "Run workflow" button with these options:

- **Web**: Deploy to Firebase Hosting only
- **Functions**: Deploy Firebase Functions only
- **Android**: Build Android APK/AAB
- **iOS**: Build iOS app
- **All**: Deploy everything

## 📱 Mobile App Setup

### Android Configuration

1. **Update build.gradle**: Ensure your `android/app/build.gradle` has signing config:

```gradle
android {
    signingConfigs {
        release {
            if (project.hasProperty('ANDROID_KEYSTORE_FILE')) {
                storeFile file(ANDROID_KEYSTORE_FILE)
                storePassword ANDROID_KEYSTORE_PASSWORD
                keyAlias ANDROID_KEY_ALIAS
                keyPassword ANDROID_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

2. **App Signing**: Configure keystore environment variables in CI

### iOS Configuration

1. **Certificates**: Configure provisioning profiles and certificates
2. **Fastlane**: Consider setting up Fastlane for advanced iOS deployment
3. **Code Signing**: Set up automatic code signing in Xcode

## ⚡ Firebase Functions

Functions are automatically deployed when:

- Pushing to master branch
- Manual deployment with "functions" or "all" option

### Local Development

```bash
cd functions
npm run start  # Starts emulators with import data
```

### Manual Deployment

```bash
cd functions
npm run deploy
```

## 🔍 Quality Checks

All deployments require passing:

- **TypeScript compilation**: `npm run type-check`
- **ESLint**: `npm run lint:check`
- **Prettier**: `npm run format:check`
- **Jest tests**: `npm run test:coverage`

### Release Management

- Automatic GitHub releases created for master deployments
- Includes changelog and deployment status
- Version based on package.json

## 🐛 Troubleshooting

### Common Issues

#### Build Failures

1. **Dependencies**: Run `npm ci` to clean install
2. **TypeScript errors**: Fix with `npm run type-check`
3. **Lint issues**: Auto-fix with `npm run lint`

#### Firebase Deployment Issues

1. **Permissions**: Verify service account has required roles
2. **Project ID**: Ensure correct project ID in firebase.json
3. **Functions timeout**: Increase timeout in functions source

#### Mobile Build Issues

1. **Android**: Check gradle wrapper permissions and Java version
2. **iOS**: Verify Xcode version and provisioning profiles
3. **Capacitor**: Run `npx cap sync` to update native projects

### Debugging Workflow

1. Check Actions tab in GitHub repository
2. Review job logs for specific error messages
3. Test locally with same Node.js version
4. Verify all required secrets are configured

## 🔄 Workflow Customization

### Environment-Specific Deployments

Modify the workflow conditions to match your branching strategy:

```yaml
# Example: Deploy staging on develop branch
if: github.ref == 'refs/heads/develop'
```

### Additional Build Steps

Add custom steps before deployment:

```yaml
- name: Custom build step
  run: npm run custom-script
```

### Different Firebase Projects

Use environment-specific configurations:

```yaml
- name: Deploy to staging
  if: github.ref == 'refs/heads/develop'
  run: firebase deploy --project staging
```

## 📚 Additional Resources

- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Ionic Deployment Guide](https://ionicframework.com/docs/deployment/app-store)
- [Capacitor Android Guide](https://capacitorjs.com/docs/android/deploying-to-google-play)
- [Capacitor iOS Guide](https://capacitorjs.com/docs/ios/deploying-to-app-store)

---

## 🤝 Contributing

When contributing:

1. Create feature branch from `dev`
2. Ensure all quality checks pass
3. Submit PR to `dev` branch
4. Merge to `master` triggers production deployment

For questions or issues with deployment, please create an issue in the repository.

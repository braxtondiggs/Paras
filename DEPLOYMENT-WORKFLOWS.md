# Deployment Workflows

This repository uses a single, comprehensive GitHub Actions workflow for all deployment needs.

## Main Workflow (`.github/workflows/main.yml`)

The `🚀 Deployment Pipeline` handles all your deployment requirements in one streamlined workflow.

**Triggers:**

- Push to `master` branch (deploys functions automatically)
- Push to `dev` branch (deploys functions automatically)
- Pull requests to `master` (quality checks only)
- Manual trigger with deployment options

**Features:**

- 🔍 Quality checks (linting, type checking, testing, formatting)
- ⚡ Firebase Functions deployment
- 🤖 Android APK/AAB builds
- 🍎 iOS builds (disabled but ready to enable)

## Workflow Behavior

### Automatic Deployments

- **Functions**: Automatically deploy on push to `master` or `dev` branches
- **Quality Checks**: Run on all pushes and pull requests

### Manual Deployments

Use the "Run workflow" button in GitHub Actions with these options:

- **functions**: Deploy Firebase Functions only
- **android**: Build Android APK/AAB
- **all**: Deploy functions AND build Android

### Smart Triggers

- **Android builds**: Also trigger on master commits containing `[android]`
- **Path filtering**: Only runs when relevant files change (functions/, src/, etc.)

## Setup Instructions

### Required GitHub Secrets

1. **FIREBASE_TOKEN**
   ```bash
   # Generate using Firebase CLI
   firebase login:ci
   # Copy the token and add as secret
   ```

### Optional Secrets (for Android release builds)

- `ANDROID_KEYSTORE_FILE` - Base64 encoded keystore
- `ANDROID_KEYSTORE_PASSWORD` - Keystore password
- `ANDROID_KEY_ALIAS` - Key alias
- `ANDROID_KEY_PASSWORD` - Key password

## Re-enabling iOS Builds

When you need iOS builds:

1. **Uncomment the iOS section** in `main.yml` (remove all `#` from iOS job)
2. **Add `ios` to workflow options**:
   ```yaml
   options:
     - functions
     - android
     - ios # Add this
     - all
   ```

## Usage Examples

### Deploy Functions Only

```bash
git push origin dev  # Auto-deploys functions
# OR manually trigger with "functions" option
```

### Build Android App

```bash
git commit -m "New feature [android]"  # Triggers Android build on master
# OR manually trigger with "android" option
```

### Full Deployment

```bash
# Manually trigger with "all" option for functions + Android
```

## Simplified Architecture

✅ **One workflow file** handles everything
✅ **Smart triggers** reduce unnecessary runs  
✅ **Path filtering** for efficiency
✅ **Quality gates** before any deployment
✅ **Artifact storage** for built apps

This streamlined approach eliminates workflow duplication and provides a single source of truth for all deployments! 🎉

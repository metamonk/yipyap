# yipyap

An encrypted, real-time messaging application built with React Native, Expo, and Firebase.

## Features

- Real-time messaging with Firebase Firestore
- End-to-end encryption for secure communications
- Cross-platform support (iOS, Android, Web)
- User authentication with Firebase Auth
- Media sharing via Firebase Storage

## Tech Stack

- **Frontend:** React Native 0.81.4 with Expo 54.0.x
- **Language:** TypeScript 5.9.2 (strict mode)
- **Navigation:** Expo Router
- **Backend:** Firebase (Auth, Firestore, Storage)
- **State Management:** Zustand
- **Testing:** Jest + React Native Testing Library
- **CI/CD:** GitHub Actions + EAS Build

## Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Expo CLI
- Firebase account
- iOS Simulator (macOS) or Android Emulator
- Java 17+ (required for Firebase Emulator Suite)

## Setup Instructions

### 1. Clone the repository

```bash
git clone <repository-url>
cd yipyap
```

### 2. Install dependencies

```bash
npm install --legacy-peer-deps
```

### 3. Configure environment variables

Copy the example environment file and fill in your Firebase configuration:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Firebase project credentials:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### 4. Deploy Firebase rules and indexes

Install Firebase CLI if you haven't already:

```bash
npm install -g firebase-tools
```

Login to Firebase:

```bash
firebase login
```

Initialize Firebase (select your project):

```bash
firebase use --add
```

Deploy Firestore rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 5. Run the development server

```bash
npm start
```

This will start the Expo development server. You can then:

- Press `i` to open iOS simulator
- Press `a` to open Android emulator
- Press `w` to open in web browser
- Scan the QR code with Expo Go app on your mobile device

## Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android emulator
- `npm run ios` - Run on iOS simulator
- `npm run web` - Run in web browser
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking
- `npm test` - Run Jest tests
- `npm run test:rules` - Run Firebase security rules tests
- `npm run emulator` - Start Firebase Emulator Suite

## Project Structure

```
yipyap/
├── app/                    # Expo Router app directory
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Main app tabs (future)
│   ├── _layout.tsx        # Root layout
│   └── index.tsx          # Entry redirect
├── components/            # Reusable React components
├── services/              # Firebase and API services
│   └── firebase.ts        # Firebase initialization
├── stores/                # Zustand state stores
├── types/                 # TypeScript type definitions
├── constants/             # App constants and config
│   └── Config.ts          # Environment configuration
├── hooks/                 # Custom React hooks
├── utils/                 # Utility functions
├── firebase/              # Firebase configuration files
│   ├── firestore.rules    # Firestore security rules
│   ├── firestore.indexes.json  # Firestore indexes
│   └── storage.rules      # Storage security rules
├── .github/workflows/     # CI/CD workflows
├── assets/                # Images and static assets
└── tests/                 # Test files
```

## Firebase Configuration

This project uses the Firebase JavaScript SDK (not React Native Firebase) for compatibility with Expo Go. Configuration is done via environment variables and API keys.

### Security Rules

Security rules are located in the `firebase/` directory:

- `firestore.rules` - Firestore database security rules
- `storage.rules` - Firebase Storage security rules
- `firestore.indexes.json` - Firestore composite indexes
- `SECURITY_RULES.md` - Comprehensive security rules documentation

**Deploy changes:**

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
```

**Test security rules locally:**

See [firebase/SECURITY_RULES.md](firebase/SECURITY_RULES.md) for detailed testing instructions.

Quick start:

```bash
# Install Java 17+ if not already installed (macOS)
brew install openjdk@17

# Add Java to PATH
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"

# Run security rules tests (auto-starts/stops emulators)
npm run test:rules
```

**Security rules test coverage:**

- ✅ 35 automated tests validating all Firestore and Storage security rules
- ✅ Tests run against Firebase Emulator Suite locally
- ✅ 100% coverage of access control rules and edge cases

## Development Workflow

### Code Quality

The project enforces code quality through:

- **ESLint** - Linting for TypeScript and React
- **Prettier** - Code formatting
- **Husky** - Pre-commit hooks
- **lint-staged** - Run linters on staged files

All code is automatically checked before commits.

### TypeScript

The project uses TypeScript in strict mode. All environment variables must be accessed through the `Config` object in `constants/Config.ts`.

### Coding Standards

- Never access Firebase directly from components - use the service layer
- Access environment variables only through `Config` object
- All async operations must have try-catch blocks
- Document all public APIs with JSDoc/TSDoc comments

## CI/CD

### GitHub Actions

Two workflows are configured:

1. **CI** (`.github/workflows/ci.yaml`) - Runs on push/PR
   - Type checking
   - Linting
   - Tests
   - Build verification

2. **EAS Build** (`.github/workflows/eas-build.yaml`) - Manual workflow dispatch
   - Builds for iOS/Android
   - Multiple profiles (development, preview, production)

### EAS Build

Configure build profiles in `eas.json`. To build manually:

```bash
npx eas build --platform ios --profile preview
```

For CI/CD builds, ensure `EXPO_TOKEN` is set in GitHub secrets.

## Testing

### Application Tests

Run application tests with:

```bash
npm test                  # Run all tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage report
```

Test files should be placed in the `tests/` directory with the following structure:

- `tests/unit/` - Unit tests (components, services, hooks)
- `tests/integration/` - Integration tests (workflows, API interactions)
- `tests/rules/` - Firebase security rules tests

### Security Rules Tests

Security rules tests validate Firestore and Storage access control rules:

```bash
# Requires Java 17+ to be installed and in PATH
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"

# Run security rules tests (auto-starts Firebase Emulator)
npm run test:rules
```

**Test coverage:**

- ✅ **Firestore rules**: 20 tests (Users collection, Usernames collection, Default deny)
- ✅ **Storage rules**: 15 tests (Profile photos, Default deny)

See [firebase/SECURITY_RULES.md](firebase/SECURITY_RULES.md) for detailed documentation.

## Troubleshooting

### Firebase initialization fails

- Verify `.env.local` contains correct Firebase credentials
- Ensure Firebase project exists and services are enabled
- Check Firebase console for API key restrictions

### Build errors with npm

Try using `--legacy-peer-deps` flag:

```bash
npm install --legacy-peer-deps
```

### Expo Go crashes or won't load

- Clear Expo cache: `npx expo start -c`
- Restart the bundler
- Check for console errors in terminal

### Type errors in development

Run type checking to see all errors:

```bash
npm run type-check
```

## Architecture Documentation

Detailed architecture documentation is available in the `docs/` directory:

- [Product Requirements](docs/prd/)
- [Technical Architecture](docs/architecture/)
- [Development Stories](docs/stories/)

## Contributing

1. Create a feature branch
2. Make your changes
3. Ensure tests pass and code is formatted
4. Submit a pull request

## License

[License details to be added]

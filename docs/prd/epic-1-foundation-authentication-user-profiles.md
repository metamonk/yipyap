# Epic 1: Foundation, Authentication & User Profiles

**Expanded Goal:** Establish the complete technical foundation for yipyap including React Native/Expo project structure, TypeScript configuration, Firebase integration, Git repository, and CI/CD pipeline. Deliver functional user authentication (registration and login via Firebase Auth) and user profile management so that users can create accounts, securely authenticate, and manage their profile information. By the end of this epic, users can register, login, and view/edit their profiles—providing the identity foundation required for all messaging features.

## Story 1.1: Project Foundation & Infrastructure Setup

**User Story:**
As a developer,
I want the React Native/Expo project scaffolded with TypeScript, Firebase, and CI/CD configured,
so that I have a solid foundation to build features on with quality tooling in place.

**Acceptance Criteria:**

1. React Native project initialized with Expo managed workflow (latest stable version)
2. TypeScript configured with strict mode enabled and proper tsconfig.json settings
3. Firebase project created with development and production environments
4. Firebase SDK integrated (Auth, Firestore, Cloud Messaging) with environment-based configuration
5. Git repository initialized with .gitignore configured for React Native/Expo
6. ESLint and Prettier configured with TypeScript + React Native rules
7. Basic app structure created with navigation placeholder (React Navigation installed)
8. CI/CD pipeline configured (GitHub Actions or EAS Build) for automated builds
9. App displays a simple "Welcome to yipyap" canary screen on launch (proof of working app)
10. Project documentation includes setup instructions and architecture overview

---

## Story 1.2: User Registration Flow

**User Story:**
As a new user,
I want to register for an account using email and password,
so that I can create my yipyap identity and access the app.

**Acceptance Criteria:**

1. Registration screen displays input fields for email, password, and confirm password
2. Email validation ensures proper email format before submission
3. Password validation enforces minimum 8 characters with clear error messaging
4. Confirm password field validates password match before submission
5. Firebase Auth createUserWithEmailAndPassword successfully creates user account
6. Registration errors (email already exists, weak password, network errors) display user-friendly error messages
7. Successful registration automatically logs user in and navigates to profile setup
8. Loading state displayed during registration API call
9. TypeScript types defined for registration form data and error states

---

## Story 1.3: User Login & Session Management

**User Story:**
As a returning user,
I want to login with my email and password,
so that I can access my yipyap account and conversations.

**Acceptance Criteria:**

1. Login screen displays input fields for email and password
2. Firebase Auth signInWithEmailAndPassword authenticates user credentials
3. Invalid credentials display clear "Invalid email or password" error message
4. Successful login navigates user to conversation list (or profile setup if profile incomplete)
5. Firebase Auth session persistence maintains login state across app restarts
6. "Forgot Password" link navigates to password reset flow using Firebase sendPasswordResetEmail
7. Password reset email sent successfully with confirmation message displayed
8. Auth state listener (onAuthStateChanged) detects logged-in users on app launch and skips login screen
9. Logout functionality available in settings (signs user out and returns to login screen)
10. Loading states displayed during login and auth state checks

---

## Story 1.4: User Profile Creation & Management

**User Story:**
As a registered user,
I want to create and edit my profile with username, display name, and profile photo,
so that other users can identify me in conversations.

**Acceptance Criteria:**

1. Profile setup screen displays after first registration requiring username and display name
2. Username field validates uniqueness in Firestore (no duplicate usernames allowed)
3. Display name field accepts alphanumeric characters and spaces (up to 50 characters)
4. Profile photo upload allows user to select image from device photo library
5. Selected profile photo uploads to Firebase Storage with proper compression (max 500KB)
6. Profile data (username, displayName, photoURL) stored in Firestore users collection
7. Profile edit screen accessible from settings allows updating display name and profile photo
8. Username cannot be changed after initial setup (displays as read-only)
9. Profile changes save to Firestore and update immediately in UI (optimistic update)
10. Default avatar/placeholder displayed if user skips profile photo upload

---

## Story 1.5: Firebase Security Rules for User Data

**User Story:**
As a platform administrator,
I want Firebase Security Rules configured to protect user data,
so that users can only access and modify their own profile information.

**Acceptance Criteria:**

1. Firestore Security Rules deployed for users collection
2. Users can read only their own user document (authenticated user ID matches document ID)
3. Users can write/update only their own user document
4. Username uniqueness validation rule prevents duplicate usernames during profile creation
5. Firebase Storage Security Rules ensure users can upload only to their own profile photo path
6. Unauthenticated requests to Firestore and Storage are denied
7. Security rules tested using Firebase Emulator Suite with passing test cases
8. Security rules documentation added to repository with explanation of access patterns

---

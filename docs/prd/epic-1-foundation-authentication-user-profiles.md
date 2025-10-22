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
I want to register for an account using my email and password,
so that I can create my yipyap identity and access the app securely.

**Acceptance Criteria:**

1. Registration screen displays email and password input fields with appropriate keyboard types
2. Email field validates proper email format (using regex pattern validation)
3. Password field requires minimum 8 characters, with at least one uppercase, one lowercase, and one number
4. Password field includes show/hide toggle for visibility
5. Confirm password field validates matching with password field
6. "Create Account" button triggers Firebase Auth createUserWithEmailAndPassword
7. Registration errors (weak password, email already in use, invalid email) display user-friendly error messages
8. Successful registration automatically logs user in and navigates to username setup
9. Loading state displayed during account creation
10. TypeScript types defined for auth state, form data, and error states
11. Display name can be set during registration (optional field)

---

## Story 1.3: User Login & Session Management

**User Story:**
As a returning user,
I want to login with my email and password,
so that I can access my yipyap account and conversations.

**Acceptance Criteria:**

1. Login screen displays email and password input fields with "Sign In" button
2. Email field includes keyboard type for email addresses
3. Password field is masked with show/hide toggle option
4. "Forgot Password?" link navigates to password reset screen
5. Firebase Auth signInWithEmailAndPassword authenticates user credentials
6. Authentication errors (wrong password, user not found, network issues) display clear error messages
7. Successful login navigates user to conversation list (or username setup if profile incomplete)
8. Firebase Auth session persistence maintains login state across app restarts
9. Auth state listener (onAuthStateChanged) detects logged-in users on app launch and skips login screen
10. Logout functionality available in settings (signs user out and returns to login screen)
11. Loading states displayed during login and auth state checks
12. "Create Account" link navigates to registration screen for new users

---

## Story 1.4: User Profile Creation & Management

**User Story:**
As a registered user,
I want to set my unique username and customize my display name and photo,
so that other users can identify me in conversations.

**Acceptance Criteria:**

1. Username setup screen displays after first successful registration requiring only a unique username
2. Username field validates uniqueness in Firestore (no duplicate usernames allowed)
3. Username accepts alphanumeric characters and underscores (3-20 characters, lowercase enforced)
4. Display name field pre-populated from registration (if provided) or empty
5. User can set or edit display name (up to 50 characters) during setup
6. User can optionally upload a profile photo (default avatar shown if not provided)
7. Profile data (username, displayName, photoURL, email) stored in Firestore users collection
8. Profile edit screen accessible from settings allows updating display name and profile photo
9. Username cannot be changed after initial setup (displays as read-only)
10. Profile changes save to Firestore and update immediately in UI (optimistic update)

---

## Story 1.5: Password Reset Flow

**User Story:**
As a user who forgot my password,
I want to reset my password via email,
so that I can regain access to my account.

**Acceptance Criteria:**

1. "Forgot Password?" link on login screen navigates to password reset screen
2. Password reset screen displays email input field with "Send Reset Email" button
3. Email field validates proper email format before submission
4. Firebase Auth sendPasswordResetEmail sends reset email to provided address
5. Success message displays after email sent: "Password reset email sent. Check your inbox."
6. Error messages display for invalid email or user not found
7. "Back to Login" button returns to login screen
8. Reset email contains secure link to Firebase password reset page
9. After password reset via email link, user can login with new password
10. Loading state displayed during email sending process

---

## Story 1.6: Firebase Security Rules for User Data

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

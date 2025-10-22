# Firebase Security Rules Documentation

This document explains the security rules for Firestore and Firebase Storage in the yipyap application.

## Overview

Firebase Security Rules provide server-side security and validation for Firestore and Storage. Rules are evaluated on Firebase servers before any read or write operation, ensuring data protection regardless of client code.

**Key Security Principles:**

- **Deny by default**: All undefined paths are explicitly denied
- **Authentication required**: Most operations require an authenticated user
- **Path-based access control**: Rules match document paths and validate `auth.uid`
- **Data validation**: Rules validate request data structure and content
- **Server-side enforcement**: Cannot be bypassed by malicious client code

---

## Firestore Security Rules

**Location:** `/firebase/firestore.rules`

### Rules Overview

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Users collection - users can only read/write their own profile with data validation
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;

      // Write with comprehensive data validation
      allow write: if request.auth != null &&
                      request.auth.uid == userId &&
                      // Validate required fields exist
                      request.resource.data.keys().hasAll(['uid', 'username', 'displayName', 'email', 'presence', 'settings', 'createdAt', 'updatedAt']) &&
                      // Validate uid matches authenticated user
                      request.resource.data.uid == request.auth.uid &&
                      // Validate username format and length (3-20 chars, lowercase alphanumeric + underscore)
                      request.resource.data.username is string &&
                      request.resource.data.username.size() >= 3 &&
                      request.resource.data.username.size() <= 20 &&
                      request.resource.data.username.matches('^[a-z0-9_]+$') &&
                      // Validate displayName length (1-50 chars)
                      request.resource.data.displayName is string &&
                      request.resource.data.displayName.size() >= 1 &&
                      request.resource.data.displayName.size() <= 50 &&
                      // Validate email is a string
                      request.resource.data.email is string &&
                      request.resource.data.email.size() > 0 &&
                      // Validate presence object structure
                      request.resource.data.presence is map &&
                      request.resource.data.presence.keys().hasAll(['status', 'lastSeen']) &&
                      request.resource.data.presence.status in ['online', 'offline'] &&
                      request.resource.data.presence.lastSeen is timestamp &&
                      // Validate settings object structure
                      request.resource.data.settings is map &&
                      request.resource.data.settings.keys().hasAll(['sendReadReceipts', 'notificationsEnabled']) &&
                      request.resource.data.settings.sendReadReceipts is bool &&
                      request.resource.data.settings.notificationsEnabled is bool &&
                      // Validate timestamps
                      request.resource.data.createdAt is timestamp &&
                      request.resource.data.updatedAt is timestamp &&
                      // Optional fields validation (if present)
                      (!request.resource.data.keys().hasAny(['photoURL']) || request.resource.data.photoURL is string) &&
                      (!request.resource.data.keys().hasAny(['fcmToken']) || request.resource.data.fcmToken is string);
    }

    // Username uniqueness collection
    match /usernames/{username} {
      allow read: if true;
      allow create: if request.auth != null &&
        request.auth.uid == request.resource.data.uid;
      allow update, delete: if false;
    }

    // Default deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

### Users Collection Rules

**Path:** `/users/{userId}`

#### Read Access

```javascript
allow read: if request.auth != null && request.auth.uid == userId;
```

**What this allows:**

- ✅ Authenticated users can read their own user document
- ✅ Example: User `alice-uid` can read `/users/alice-uid`

**What this denies:**

- ❌ Unauthenticated users cannot read any user documents
- ❌ Authenticated users cannot read other users' documents
- ❌ Example: User `alice-uid` CANNOT read `/users/bob-uid`

**Purpose:** Ensures user profile privacy - users can only access their own profile data.

---

#### Write Access with Data Validation

The write rule includes comprehensive server-side data validation to ensure data integrity:

**Authentication & Authorization:**

```javascript
request.auth != null && request.auth.uid == userId;
```

- User must be authenticated
- Authenticated UID must match the document path

**Required Fields Validation:**

```javascript
request.resource.data
  .keys()
  .hasAll([
    'uid',
    'username',
    'displayName',
    'email',
    'presence',
    'settings',
    'createdAt',
    'updatedAt',
  ]);
```

- All required fields must be present in the document

**Username Validation:**

```javascript
request.resource.data.username is string &&
request.resource.data.username.size() >= 3 &&
request.resource.data.username.size() <= 20 &&
request.resource.data.username.matches('^[a-z0-9_]+$')
```

- ✅ Must be a string
- ✅ Length: 3-20 characters
- ✅ Format: lowercase letters, numbers, and underscores only
- ❌ No uppercase letters, spaces, or special characters

**Display Name Validation:**

```javascript
request.resource.data.displayName is string &&
request.resource.data.displayName.size() >= 1 &&
request.resource.data.displayName.size() <= 50
```

- ✅ Must be a string
- ✅ Length: 1-50 characters

**Email Validation:**

```javascript
request.resource.data.email is string &&
request.resource.data.email.size() > 0
```

- ✅ Must be a non-empty string

**Presence Object Validation:**

```javascript
request.resource.data.presence is map &&
request.resource.data.presence.keys().hasAll(['status', 'lastSeen']) &&
request.resource.data.presence.status in ['online', 'offline'] &&
request.resource.data.presence.lastSeen is timestamp
```

- ✅ Must be a map with `status` and `lastSeen` fields
- ✅ Status must be either 'online' or 'offline'
- ✅ lastSeen must be a timestamp

**Settings Object Validation:**

```javascript
request.resource.data.settings is map &&
request.resource.data.settings.keys().hasAll(['sendReadReceipts', 'notificationsEnabled']) &&
request.resource.data.settings.sendReadReceipts is bool &&
request.resource.data.settings.notificationsEnabled is bool
```

- ✅ Must be a map with `sendReadReceipts` and `notificationsEnabled` fields
- ✅ Both fields must be booleans

**Timestamp Validation:**

```javascript
request.resource.data.createdAt is timestamp &&
request.resource.data.updatedAt is timestamp
```

- ✅ Both createdAt and updatedAt must be timestamps

**Optional Fields Validation:**

```javascript
(!request.resource.data.keys().hasAny(['photoURL']) || request.resource.data.photoURL is string) &&
(!request.resource.data.keys().hasAny(['fcmToken']) || request.resource.data.fcmToken is string)
```

- ✅ photoURL (if present) must be a string
- ✅ fcmToken (if present) must be a string

**What this allows:**

- ✅ Authenticated users can create/update their own user document with valid data
- ✅ Example: User `alice-uid` can write to `/users/alice-uid` with all required fields

**What this denies:**

- ❌ Documents with missing required fields
- ❌ Documents with invalid username format (e.g., uppercase, special characters)
- ❌ Documents with username shorter than 3 or longer than 20 characters
- ❌ Documents with displayName longer than 50 characters
- ❌ Documents with invalid presence status (not 'online' or 'offline')
- ❌ Documents with wrong field types (e.g., string instead of boolean)
- ❌ Unauthenticated users cannot create or update any user documents
- ❌ Authenticated users cannot create or update other users' documents

**Purpose:** Ensures data integrity by validating document structure and field constraints server-side, preventing malicious clients from writing invalid data.

---

### Usernames Collection Rules

**Path:** `/usernames/{username}`

The `usernames` collection is used for username uniqueness validation. Each document maps a username (lowercase) to the user ID who owns it.

**Document Structure:**

```typescript
{
  uid: string; // The Firebase Auth UID of the user who owns this username
}
```

#### Read Access

```javascript
allow read: if true;
```

**What this allows:**

- ✅ Anyone (authenticated or not) can read username documents
- ✅ Example: Check if username "alice" is available

**Purpose:** Allows username availability checks during registration without requiring authentication.

---

#### Create Access

```javascript
allow create: if request.auth != null &&
  request.auth.uid == request.resource.data.uid;
```

**What this allows:**

- ✅ Authenticated users can create a username claim if the `uid` field matches their auth UID
- ✅ Example: User `alice-uid` can create `/usernames/alice` with `{ uid: 'alice-uid' }`

**What this denies:**

- ❌ Unauthenticated users cannot create username claims
- ❌ Authenticated users cannot create username claims with a different user's UID
- ❌ Example: User `alice-uid` CANNOT create `/usernames/bob` with `{ uid: 'bob-uid' }`

**Purpose:** Prevents username hijacking - ensures users can only claim usernames for themselves.

---

#### Update/Delete Access

```javascript
allow update, delete: if false;
```

**What this denies:**

- ❌ No one can update username documents (usernames are immutable)
- ❌ No one can delete username documents (usernames are permanent)

**Purpose:** Enforces username permanence - once claimed, usernames cannot be changed or released.

---

### Default Deny Rule

```javascript
match /{document=**} {
  allow read, write: if false;
}
```

**What this denies:**

- ❌ All access to any undefined collection or document path
- ❌ Example: Access to `/messages/**`, `/conversations/**`, etc.

**Purpose:** Fail-secure default - any path not explicitly allowed is denied.

---

## Firebase Storage Security Rules

**Location:** `/firebase/storage.rules`

### Rules Overview

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    // Profile photos - users can only upload to their own folder with file validation
    match /users/{userId}/profile.jpg {
      allow read: if request.auth != null;

      // Allow delete without validation (no request.resource for deletes)
      allow delete: if request.auth != null && request.auth.uid == userId;

      // Upload/update with file size and type validation
      allow create, update: if request.auth != null &&
                               request.auth.uid == userId &&
                               // Validate file size (5MB max)
                               request.resource.size < 5 * 1024 * 1024 &&
                               // Validate content type (images only)
                               request.resource.contentType.matches('image/.*');
    }

    // Default deny all other access
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

### Profile Photos Rules

**Path:** `/users/{userId}/profile.jpg`

#### Read Access

```javascript
allow read: if request.auth != null;
```

**What this allows:**

- ✅ Any authenticated user can read any profile photo
- ✅ Example: User `bob-uid` can view `alice-uid`'s profile photo
- ✅ Example: User `alice-uid` can view their own profile photo

**What this denies:**

- ❌ Unauthenticated users cannot read profile photos

**Purpose:** Profile photos are visible to all authenticated users within the app (similar to social media profile pictures).

---

#### Write Access (Upload/Update/Delete) with File Validation

The write rules include file size and content type validation to prevent abuse:

**Delete Access:**

```javascript
allow delete: if request.auth != null && request.auth.uid == userId;
```

- Users can only delete their own profile photo
- No file validation needed (no `request.resource` for deletes)

**Create/Update Access with Validation:**

```javascript
allow create, update: if request.auth != null &&
                         request.auth.uid == userId &&
                         request.resource.size < 5 * 1024 * 1024 &&
                         request.resource.contentType.matches('image/.*');
```

**Authentication & Authorization:**

- User must be authenticated
- Authenticated UID must match the user path

**File Size Validation:**

```javascript
request.resource.size < 5 * 1024 * 1024;
```

- ✅ Maximum file size: 5MB (5,242,880 bytes)
- ❌ Files larger than 5MB are rejected
- **Purpose:** Prevents storage cost abuse from large file uploads

**Content Type Validation:**

```javascript
request.resource.contentType.matches('image/.*');
```

- ✅ Allowed: image/jpeg, image/png, image/gif, image/webp, etc.
- ❌ Rejected: text/plain, application/pdf, video/mp4, etc.
- **Purpose:** Ensures only image files are uploaded as profile photos

**What this allows:**

- ✅ Upload valid image files under 5MB
- ✅ Update existing photos with valid images under 5MB
- ✅ Delete own profile photo
- ✅ Example: User `alice-uid` can upload a 2MB JPEG to `/users/alice-uid/profile.jpg`

**What this denies:**

- ❌ Files larger than 5MB (storage cost control)
- ❌ Non-image files (PDF, text, video, etc.)
- ❌ Uploads without content type metadata
- ❌ Unauthenticated users cannot upload profile photos
- ❌ Authenticated users cannot upload to other users' profile photo paths
- ❌ Example: User `alice-uid` CANNOT upload to `/users/bob-uid/profile.jpg`
- ❌ Example: User `alice-uid` CANNOT upload a 10MB image (exceeds size limit)
- ❌ Example: User `alice-uid` CANNOT upload a PDF file (wrong content type)

**Purpose:** Prevents malicious users from overwriting or deleting other users' profile photos, and prevents storage abuse through large or invalid file uploads.

---

### Default Deny Rule

```javascript
match /{allPaths=**} {
  allow read, write: if false;
}
```

**What this denies:**

- ❌ All access to any undefined storage path
- ❌ Example: Access to `/media/**`, `/uploads/**`, etc.

**Purpose:** Fail-secure default - any path not explicitly allowed is denied.

---

## Testing Security Rules

### Prerequisites

1. **Java Runtime**: Firebase Emulator requires Java 17 or higher

   ```bash
   brew install openjdk@17
   export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
   ```

2. **Firebase Emulator Suite**: Installed via `firebase-tools` (already in devDependencies)

3. **Testing Library**: `@firebase/rules-unit-testing` (already in devDependencies)

---

### Running Tests Locally

#### Start Firebase Emulator (Manual)

```bash
npm run emulator
```

This starts Firestore and Storage emulators:

- Firestore: `http://localhost:8080`
- Storage: `http://localhost:9199`
- Emulator UI: `http://localhost:4000`

---

#### Run Security Rules Tests

```bash
# Run tests with auto-start/stop of emulators
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
npm run test:rules
```

**Test Output:**

- ✅ **60 tests** covering all security rules and data validation
- ✅ **Firestore tests**: 34 tests - Users collection (read/write/validation), Usernames collection (read/create/update/delete)
- ✅ **Storage tests**: 26 tests - Profile photos (read/write/delete/validation), Default deny rules

---

### Test Files

**Firestore Rules Tests:**

- Location: `/tests/rules/firestore.test.ts`
- Tests: 34 test cases
- Coverage:
  - Users collection read/write access (7 tests)
  - Users collection data validation (14 tests)
  - Usernames collection read/write access (9 tests)
  - Default deny rules (4 tests)

**Storage Rules Tests:**

- Location: `/tests/rules/storage.test.ts`
- Tests: 26 test cases
- Coverage:
  - Profile photos read access (3 tests)
  - Profile photos write access - upload (3 tests)
  - Profile photos write access - update (2 tests)
  - Profile photos write access - delete (3 tests)
  - Profile photos file validation (11 tests)
  - Default deny rules (4 tests)

---

## Deploying Security Rules

### Prerequisites

1. **Firebase CLI**: Installed via `firebase-tools` (already in devDependencies)

2. **Firebase Project**: Configured with `.firebaserc` or via CLI

---

### Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

**What this deploys:**

- Firestore security rules from `/firebase/firestore.rules`
- Rules are applied to the Firestore database immediately
- Verify deployment in [Firebase Console](https://console.firebase.google.com) → Firestore → Rules

---

### Deploy Storage Rules

```bash
firebase deploy --only storage:rules
```

**What this deploys:**

- Storage security rules from `/firebase/storage.rules`
- Rules are applied to Firebase Storage immediately
- Verify deployment in [Firebase Console](https://console.firebase.google.com) → Storage → Rules

---

### Deploy All Rules

```bash
firebase deploy --only firestore:rules,storage:rules
```

**What this deploys:**

- Both Firestore and Storage security rules in a single command

---

## Security Best Practices

### ✅ Do's

1. **Always require authentication** for sensitive operations
2. **Validate `auth.uid`** matches the resource path for user-specific data
3. **Use explicit allow rules** instead of implicit permissions
4. **Test all security rules** with both positive and negative test cases
5. **Keep rules simple and readable** with clear comments
6. **Use deny-by-default** with catch-all rules at the end
7. **Review rules regularly** as new features are added

---

### ❌ Don'ts

1. **Never use `allow read, write: if true`** except for truly public data
2. **Never skip authentication checks** for sensitive operations
3. **Never trust client-side validation** - always validate server-side
4. **Never hardcode user IDs** in security rules
5. **Never allow unrestricted access** to user data
6. **Never deploy untested rules** to production

---

## Troubleshooting

### Tests Fail with "fetch failed"

**Problem:** Firebase Emulator is not running

**Solution:**

```bash
# Start emulator in separate terminal
npm run emulator

# Run tests in another terminal
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
npm run test:rules
```

---

### Tests Fail with "Java not found"

**Problem:** Java runtime not installed or not in PATH

**Solution:**

```bash
# Install Java via Homebrew (macOS)
brew install openjdk@17

# Add to PATH
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"

# Verify Java installation
java -version
```

---

### Permission Denied Errors in Production

**Problem:** Security rules are too restrictive or not deployed

**Solution:**

1. Check Firebase Console → Firestore/Storage → Rules
2. Verify rules are deployed: `firebase deploy --only firestore:rules,storage:rules`
3. Test locally with emulator to reproduce issue
4. Check that `auth.uid` is correctly set in client code

---

### Rules Not Updating in Emulator

**Problem:** Emulator cached old rules

**Solution:**

```bash
# Stop emulator (Ctrl+C)
# Clear emulator data
rm -rf .firebase/

# Restart emulator
npm run emulator
```

---

## Additional Resources

- [Firestore Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Storage Security Rules Documentation](https://firebase.google.com/docs/storage/security/start)
- [Rules Unit Testing Guide](https://firebase.google.com/docs/rules/unit-tests)
- [Firebase Emulator Suite Documentation](https://firebase.google.com/docs/emulator-suite)

---

## Summary

**Firestore Security:**

- ✅ Users can only read/write their own profile
- ✅ Comprehensive data validation on write operations:
  - Required fields validation (uid, username, displayName, email, presence, settings, timestamps)
  - Username format validation (3-20 chars, lowercase alphanumeric + underscore)
  - DisplayName length validation (1-50 chars)
  - Presence status validation ('online' or 'offline')
  - Field type validation (strings, booleans, timestamps, maps)
  - Optional fields validation (photoURL, fcmToken)
- ✅ Usernames are publicly readable for availability checks
- ✅ Usernames are immutable once created
- ✅ Default deny for all undefined paths

**Storage Security:**

- ✅ Profile photos readable by all authenticated users
- ✅ Users can only upload/update/delete their own profile photo
- ✅ File validation on uploads/updates:
  - File size limit (5MB maximum)
  - Content type validation (image/\* only)
  - Prevents storage cost abuse
  - Prevents non-image uploads
- ✅ Default deny for all undefined paths

**Testing:**

- ✅ 60 automated tests validating all rules and data validation
- ✅ Firebase Emulator for local testing
- ✅ Comprehensive test coverage for positive and negative cases
- ✅ Firestore: 34 tests (access control + data validation)
- ✅ Storage: 26 tests (access control + file validation)

**Deployment:**

- ✅ Simple deployment via Firebase CLI
- ✅ Rules applied immediately upon deployment
- ✅ Verifiable in Firebase Console

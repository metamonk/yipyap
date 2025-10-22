/**
 * Manual mock for firebase/auth
 * Prevents ESM import issues in Jest
 */

export const GoogleAuthProvider = {
  credential: jest.fn(),
};

export const signInWithCredential = jest.fn();
export const signOut = jest.fn();
export const onAuthStateChanged = jest.fn();
export const createUserWithEmailAndPassword = jest.fn();
export const signInWithEmailAndPassword = jest.fn();
export const sendPasswordResetEmail = jest.fn();
export const updateProfile = jest.fn();

export type User = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

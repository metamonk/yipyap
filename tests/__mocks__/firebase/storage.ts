/**
 * Manual mock for firebase/storage
 * Prevents ESM import issues in Jest
 */

export const getStorage = jest.fn();

export type FirebaseStorage = {
  app: unknown;
};

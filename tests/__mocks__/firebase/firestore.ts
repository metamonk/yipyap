/**
 * Manual mock for firebase/firestore
 * Prevents ESM import issues in Jest
 */

export const getFirestore = jest.fn();

export type Firestore = {
  app: unknown;
};

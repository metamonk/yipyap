/**
 * Manual mock for firebase/app
 * Prevents ESM import issues in Jest
 */

export const initializeApp = jest.fn();
export const getApp = jest.fn();

export type FirebaseApp = {
  name: string;
  options: Record<string, unknown>;
};

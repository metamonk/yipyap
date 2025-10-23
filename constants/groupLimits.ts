/**
 * Group size limits and validation constants
 *
 * @module constants/groupLimits
 *
 * @remarks
 * These constants define the business rules for group conversation size limits.
 * The GROUP_SIZE_LIMIT matches the Firebase Security Rules validation to ensure
 * client-side validation is consistent with server-side enforcement.
 *
 * Business Rationale:
 * - 50 member limit balances usability with technical constraints
 * - Prevents excessive real-time listener overhead
 * - Maintains message delivery performance (<500ms P95)
 * - Simplifies group management UI/UX
 * - Aligns with MVP scope for scalable group messaging
 *
 * @see firestore.rules - Server-side validation rules
 * @see docs/architecture/group-messaging.md - Group messaging architecture
 */

/**
 * Maximum number of participants allowed in a group conversation
 *
 * @constant
 * @type {number}
 * @default 50
 *
 * @remarks
 * This limit includes ALL participants (creator + added members).
 * Must match the validation rule in firestore.rules for consistency.
 * Changing this value requires updating:
 * - Firebase Security Rules (firestore.rules)
 * - Backend validation logic
 * - Error messages and UI text
 */
export const GROUP_SIZE_LIMIT = 50;

/**
 * Threshold for displaying visual warnings about approaching group size limit
 *
 * @constant
 * @type {number}
 * @default 45
 *
 * @remarks
 * When member count reaches this threshold, UI displays warning indicators:
 * - Counter text changes to warning color (orange)
 * - Warning message appears
 * - Progress indicator shows warning state
 */
export const GROUP_SIZE_WARNING_THRESHOLD = 45;

/**
 * Error message displayed when attempting to exceed group size limit
 *
 * @constant
 * @type {string}
 *
 * @remarks
 * User-friendly message explaining the constraint and suggesting action.
 * Displayed in alerts, toasts, and inline error components.
 */
export const GROUP_SIZE_ERROR_MESSAGE = `Groups are limited to ${GROUP_SIZE_LIMIT} members. Please remove some members to continue.`;

/**
 * Warning message displayed when approaching group size limit
 *
 * @constant
 * @type {string}
 *
 * @remarks
 * Subtle warning to help users avoid hitting the hard limit.
 * Displayed when member count >= GROUP_SIZE_WARNING_THRESHOLD.
 */
export const GROUP_SIZE_WARNING_MESSAGE = `Approaching group size limit (${GROUP_SIZE_WARNING_THRESHOLD}+ of ${GROUP_SIZE_LIMIT} members selected)`;

/**
 * Short explanation of the group size limit for tooltips and help text
 *
 * @constant
 * @type {string}
 *
 * @remarks
 * Concise text explaining why the limit exists.
 * Used in disabled button tooltips and help sections.
 */
export const GROUP_SIZE_LIMIT_EXPLANATION = `Maximum ${GROUP_SIZE_LIMIT} members per group`;

/**
 * Detailed description for accessibility screen readers
 *
 * @constant
 * @type {string}
 *
 * @remarks
 * Provides context for assistive technologies when controls are disabled.
 * Announced when focus moves to disabled "Add Member" button.
 */
export const GROUP_SIZE_LIMIT_ARIA_LABEL = `Group member limit reached. Groups can have a maximum of ${GROUP_SIZE_LIMIT} members. Remove a member to add more.`;

/**
 * Maximum number of additional members that can be selected (excludes current user)
 *
 * @constant
 * @type {number}
 * @default 9
 *
 * @remarks
 * Helper constant for UI that shows "select up to X more users".
 * Calculated as GROUP_SIZE_LIMIT - 1 (current user is automatically included).
 */
export const MAX_SELECTABLE_MEMBERS = GROUP_SIZE_LIMIT - 1;

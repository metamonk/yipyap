/**
 * Centralized configuration object for environment variables
 * @remarks
 * Access all environment variables through this Config object, never directly from process.env
 * This ensures type safety and provides a single source of truth for configuration
 */
export const Config = {
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  },
  /**
   * AI provider configuration for Phase 2 features
   * @remarks
   * Access AI-related environment variables through this section.
   * Never access process.env directly - use Config.ai.* instead.
   */
  ai: {
    /** OpenAI API key for GPT models */
    openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',

    /** OpenAI organization ID (optional) */
    openaiOrgId: process.env.EXPO_PUBLIC_OPENAI_ORG_ID || '',

    /** Vercel Edge Function base URL */
    vercelEdgeUrl: process.env.EXPO_PUBLIC_VERCEL_EDGE_URL || '',

    /** Vercel Edge Function authentication token */
    vercelEdgeToken: process.env.EXPO_PUBLIC_VERCEL_EDGE_TOKEN || '',

    /** Feature flag to enable/disable AI functionality */
    aiEnabled: process.env.EXPO_PUBLIC_AI_ENABLED === 'true',

    /** Langfuse public key for monitoring */
    langfusePublicKey: process.env.EXPO_PUBLIC_LANGFUSE_PUBLIC_KEY || '',

    /** Langfuse secret key for monitoring */
    langfuseSecretKey: process.env.EXPO_PUBLIC_LANGFUSE_SECRET_KEY || '',

    /** Langfuse API base URL */
    langfuseBaseUrl: process.env.EXPO_PUBLIC_LANGFUSE_BASE_URL || '',

    /** Upstash Redis REST URL for rate limiting */
    upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL || '',

    /** Upstash Redis REST token for authentication */
    upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  },
} as const;

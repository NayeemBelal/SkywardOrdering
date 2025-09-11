// Feature flags for the application
export const FEATURES = {
  // Enable/disable site PIN validation
  ENABLE_SITE_PINS: true,
  
  // Future feature flags can be added here
} as const;

export type FeatureFlag = keyof typeof FEATURES;

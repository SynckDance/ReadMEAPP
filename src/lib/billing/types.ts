// Unified billing types. Stripe (web) and Apple IAP (iOS) both resolve
// into the same Entitlement shape server-side.

export type PlanTier = "personal_free" | "personal_pro" | "team_free" | "team_pro";

export type BillingSource = "stripe" | "apple_iap" | "none";

export type Entitlement = {
  id: string;
  userId: string | null;
  workspaceId: string | null;
  plan: PlanTier;
  source: BillingSource;
  externalId: string | null;
  active: boolean;
  currentPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
};

export const PLAN_LIMITS: Record<PlanTier, {
  maxDocuments: number | null;
  maxDesks: number | null;
  maxBucketItems: number | null;
  maxMembers: number | null;
  aiFeatures: boolean;
}> = {
  personal_free: { maxDocuments: 10, maxDesks: 1, maxBucketItems: 100, maxMembers: 1, aiFeatures: true },
  personal_pro: { maxDocuments: null, maxDesks: null, maxBucketItems: null, maxMembers: 1, aiFeatures: true },
  team_free: { maxDocuments: 20, maxDesks: 1, maxBucketItems: 200, maxMembers: 3, aiFeatures: true },
  team_pro: { maxDocuments: null, maxDesks: null, maxBucketItems: null, maxMembers: null, aiFeatures: true },
};

/**
 * Traffic light thresholds and scoring profiles.
 * See docs/TRAFFIC_LIGHT_AND_SCORING.md §7–8.
 */

export type ScoringProfileId =
  | "lifestyle"
  | "high-performance"
  | "moderate"
  | "custom";

export interface Thresholds {
  redMax: number;
  orangeMax: number;
}

/** Default thresholds per profile (§8). */
export const SCORING_PROFILES: Record<ScoringProfileId, Thresholds> = {
  lifestyle: { redMax: 33, orangeMax: 80 },
  "high-performance": { redMax: 75, orangeMax: 89 },
  moderate: { redMax: 60, orangeMax: 85 },
  custom: { redMax: 70, orangeMax: 85 },
};

export const DEFAULT_PROFILE: ScoringProfileId = "moderate";

/** Band labels for display. */
export const BAND_LABELS: Record<"red" | "orange" | "green", string> = {
  red: "Needs Attention",
  orange: "On Track",
  green: "Excellent",
};

/** Convert legacy thresholds (red/orange arrays or red/yellow) to redMax/orangeMax. */
export function convertLegacyThresholds(th: {
  red?: number[] | unknown;
  orange?: number[] | unknown;
  yellow?: number[] | unknown;
}): Thresholds | null {
  const redMax =
    Array.isArray(th.red) && typeof th.red[1] === "number"
      ? th.red[1]
      : undefined;
  const orangeMax =
    Array.isArray(th.orange) && typeof th.orange[1] === "number"
      ? th.orange[1]
      : Array.isArray(th.yellow) && typeof th.yellow[1] === "number"
        ? th.yellow[1]
        : undefined;
  if (redMax != null && orangeMax != null) return { redMax, orangeMax };
  return null;
}

export interface ResolveThresholdsInput {
  /** Form-level thresholds (from form.thresholds). */
  formThresholds?: { redMax?: number; orangeMax?: number } | null;
  /** Client scoring doc (clientScoring collection, doc id = clientId). */
  clientScoring?: {
    thresholds?: {
      redMax?: number;
      orangeMax?: number;
      red?: number[];
      orange?: number[];
      yellow?: number[];
    };
    scoringProfile?: string;
  } | null;
}

/**
 * Resolve traffic light thresholds per doc §7:
 * 1. Form thresholds (if both redMax and orangeMax set)
 * 2. Client scoring: thresholds.redMax/orangeMax, or legacy red/orange/yellow, or scoringProfile
 * 3. Default: moderate profile
 */
export function resolveThresholds(input: ResolveThresholdsInput): Thresholds {
  const { formThresholds, clientScoring } = input;

  if (
    formThresholds &&
    typeof formThresholds.redMax === "number" &&
    typeof formThresholds.orangeMax === "number"
  ) {
    return {
      redMax: formThresholds.redMax,
      orangeMax: formThresholds.orangeMax,
    };
  }

  const th = clientScoring?.thresholds ?? {};
  if (
    typeof th.redMax === "number" &&
    typeof th.orangeMax === "number"
  ) {
    return { redMax: th.redMax, orangeMax: th.orangeMax };
  }

  const legacy = convertLegacyThresholds(th);
  if (legacy) return legacy;

  const profileId = clientScoring?.scoringProfile as ScoringProfileId | undefined;
  if (
    profileId &&
    SCORING_PROFILES[profileId]
  ) {
    return SCORING_PROFILES[profileId];
  }

  return SCORING_PROFILES[DEFAULT_PROFILE];
}

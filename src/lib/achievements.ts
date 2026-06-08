/** V1 badge definitions — emoji icons, earned once per client. */

export type AchievementCategory = "checkin" | "habits" | "progress" | "goals";

export interface AchievementDefinition {
  id: string;
  emoji: string;
  name: string;
  description: string;
  category: AchievementCategory;
  /** 1 = easiest, higher = harder */
  difficultyRank: number;
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: "first_checkin",
    emoji: "✅",
    name: "First Step",
    description: "Complete your first check-in",
    category: "checkin",
    difficultyRank: 1,
  },
  {
    id: "baseline_builder",
    emoji: "📏",
    name: "Baseline Builder",
    description: "Log your first body measurement",
    category: "progress",
    difficultyRank: 2,
  },
  {
    id: "green_week",
    emoji: "🟢",
    name: "Green Week",
    description: "Score in the green zone on a check-in",
    category: "checkin",
    difficultyRank: 3,
  },
  {
    id: "habit_spark_7",
    emoji: "🔥",
    name: "Spark",
    description: "Reach a 7-day streak on any habit",
    category: "habits",
    difficultyRank: 4,
  },
  {
    id: "photo_ready",
    emoji: "📸",
    name: "Photo Ready",
    description: "Upload before photos — front, back, and side",
    category: "progress",
    difficultyRank: 5,
  },
  {
    id: "triple_threat",
    emoji: "💪",
    name: "Triple Threat",
    description: "Hit all three habit goals on the same day",
    category: "habits",
    difficultyRank: 6,
  },
  {
    id: "four_week_streak",
    emoji: "📅",
    name: "Four Strong",
    description: "Complete check-ins 4 weeks in a row",
    category: "checkin",
    difficultyRank: 7,
  },
  {
    id: "goal_getter",
    emoji: "🎯",
    name: "Goal Getter",
    description: "Reach 100% on a goal",
    category: "goals",
    difficultyRank: 8,
  },
];

/** Badges ordered easiest → hardest. */
export const BADGES_BY_DIFFICULTY = [...ACHIEVEMENT_DEFINITIONS].sort(
  (a, b) => a.difficultyRank - b.difficultyRank
);

export const ACHIEVEMENTS_BY_ID = Object.fromEntries(
  ACHIEVEMENT_DEFINITIONS.map((a) => [a.id, a])
) as Record<string, AchievementDefinition>;

export interface NewlyEarnedAchievement {
  id: string;
  emoji: string;
  name: string;
  description: string;
  earnedAt: string;
}

export interface AchievementListItem extends AchievementDefinition {
  earned: boolean;
  earnedAt: string | null;
}

export interface PendingAchievementItem extends AchievementDefinition {
  achievementId: string;
  eligibleAt: string;
  status: "pending";
}

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  checkin: "Check-ins",
  habits: "Habits",
  progress: "Progress",
  goals: "Goals",
};

export interface CoachBadgeAllocation {
  clientId: string;
  clientName: string;
  achievementId: string;
  emoji: string;
  name: string;
  date: string;
}

export interface CoachBadgesClientSummary {
  id: string;
  firstName: string;
  lastName: string;
  badgeAwardMode: "default" | "auto" | "coach";
  earnedCount: number;
  pendingCount: number;
  earnedIds: string[];
  pendingIds: string[];
}

export interface CoachBadgesOverview {
  definitions: AchievementDefinition[];
  defaultBadgeAwardMode: "auto" | "coach";
  badgeStats: Record<string, { earned: number; pending: number }>;
  totalEarned: number;
  totalPending: number;
  earned: CoachBadgeAllocation[];
  pending: CoachBadgeAllocation[];
  clients: CoachBadgesClientSummary[];
}

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
  {
    id: "orange_zone",
    emoji: "🟠",
    name: "On a Roll",
    description: "Score in the orange zone on a check-in",
    category: "checkin",
    difficultyRank: 9,
  },
  {
    id: "checkin_10",
    emoji: "🔟",
    name: "Ten Strong",
    description: "Complete 10 check-ins",
    category: "checkin",
    difficultyRank: 10,
  },
  {
    id: "eight_week_streak",
    emoji: "📆",
    name: "Eight Strong",
    description: "Complete check-ins 8 weeks in a row",
    category: "checkin",
    difficultyRank: 11,
  },
  {
    id: "twelve_week_streak",
    emoji: "🏆",
    name: "Twelve Strong",
    description: "Complete check-ins 12 weeks in a row",
    category: "checkin",
    difficultyRank: 12,
  },
  {
    id: "green_machine",
    emoji: "💚",
    name: "Green Machine",
    description: "Score in the green zone 3 check-ins in a row",
    category: "checkin",
    difficultyRank: 13,
  },
  {
    id: "habit_spark_14",
    emoji: "🔥",
    name: "Steady Flame",
    description: "Reach a 14-day streak on any habit",
    category: "habits",
    difficultyRank: 14,
  },
  {
    id: "habit_anchor_21",
    emoji: "⚓",
    name: "Habit Anchor",
    description: "Reach a 21-day streak on any habit",
    category: "habits",
    difficultyRank: 15,
  },
  {
    id: "habit_unstoppable_30",
    emoji: "🚀",
    name: "Unstoppable",
    description: "Reach a 30-day streak on any habit",
    category: "habits",
    difficultyRank: 16,
  },
  {
    id: "perfect_week_habits",
    emoji: "✨",
    name: "Perfect Week",
    description: "Hit all three habit goals every day for 7 days straight",
    category: "habits",
    difficultyRank: 17,
  },
  {
    id: "sleep_steward_7",
    emoji: "😴",
    name: "Sleep Steward",
    description: "Reach a 7-day streak on sleep",
    category: "habits",
    difficultyRank: 18,
  },
  {
    id: "tape_tracker_5",
    emoji: "📐",
    name: "Tape Tracker",
    description: "Log 5 body measurement entries",
    category: "progress",
    difficultyRank: 19,
  },
  {
    id: "scale_regular_10",
    emoji: "⚖️",
    name: "Scale Regular",
    description: "Log body weight 10 times",
    category: "progress",
    difficultyRank: 20,
  },
  {
    id: "progress_shots",
    emoji: "🖼️",
    name: "Progress Shots",
    description: "Upload progress photos — front, back, and side",
    category: "progress",
    difficultyRank: 21,
  },
  {
    id: "halfway_hero",
    emoji: "📈",
    name: "Halfway There",
    description: "Reach 50% progress on a goal",
    category: "goals",
    difficultyRank: 22,
  },
  {
    id: "double_down_goals",
    emoji: "🎯",
    name: "Double Down",
    description: "Complete 2 goals",
    category: "goals",
    difficultyRank: 23,
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

/**
 * Habit tracker: definitions and which option values count as "goal met" for streaks.
 */

export interface HabitOption {
  value: string;
  label: string;
  /** If true, selecting this option extends the streak */
  goalMet: boolean;
}

export interface HabitDefinition {
  id: string;
  label: string;
  description?: string;
  options: HabitOption[];
  /** Alert time for reminder (e.g. "8pm", "9am") - for display/scheduling */
  reminderTime?: string;
}

export const HABIT_DEFINITIONS: HabitDefinition[] = [
  {
    id: "steps",
    label: "Daily step count",
    description: "8pm reminder",
    reminderTime: "8pm",
    options: [
      { value: "under_7500", label: "< 7,500 steps", goalMet: false },
      { value: "7500_8500", label: "7,500 – 8,500 steps", goalMet: true },
      { value: "8500_10000", label: "8,500 – 10,000 steps", goalMet: true },
      { value: "10000_plus", label: "10,000+ steps", goalMet: true },
    ],
  },
  {
    id: "hydration",
    label: "Hydration",
    description: "8pm reminder",
    reminderTime: "8pm",
    options: [
      { value: "under_2_5", label: "< 2.5L water per day", goalMet: false },
      { value: "2_5_plus", label: "2.5L+ water per day", goalMet: true },
    ],
  },
  {
    id: "sleep",
    label: "Sleep",
    description: "9am reminder",
    reminderTime: "9am",
    options: [
      { value: "under_7", label: "< 7 hours", goalMet: false },
      { value: "7_plus", label: "7+ hours", goalMet: true },
    ],
  },
];

export function getHabitById(id: string): HabitDefinition | undefined {
  return HABIT_DEFINITIONS.find((h) => h.id === id);
}

export function isGoalMet(habitId: string, optionValue: string): boolean {
  const habit = getHabitById(habitId);
  const option = habit?.options.find((o) => o.value === optionValue);
  return option?.goalMet ?? false;
}

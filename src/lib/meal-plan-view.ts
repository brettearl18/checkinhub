type AnyObj = Record<string, unknown>;

export type MealPlanMacros = {
  calories?: number | string | null;
  protein_g?: number | string | null;
  carbs_g?: number | string | null;
  fat_g?: number | string | null;
};

export interface NormalizedMealOption {
  id: string;
  mealSlot: string;
  option: string | null;
  name: string;
  whyThisMeal: string | null;
  macros: MealPlanMacros | null;
  ingredients: AnyObj[];
  method: string[];
  isCustom: boolean;
}

export interface MealSlotGroup {
  key: string;
  label: string;
  splitPct?: number | string | null;
  suggestedTime?: string | null;
  targets: MealPlanMacros | null;
  options: NormalizedMealOption[];
}

function asObj(v: unknown): AnyObj | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as AnyObj) : null;
}

function asList(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function normalizeMealKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function readMacroValue(obj: AnyObj, keys: string[]): number | string | null {
  for (const key of keys) {
    const v = obj[key];
    if (v != null && v !== "") return v as number | string;
  }
  return null;
}

/** Normalize macro fields from nested or top-level meal objects. */
export function normalizeMealMacros(source: AnyObj | null): MealPlanMacros | null {
  if (!source) return null;
  const nested = asObj(source.macros) ?? asObj(source.macroTargets) ?? asObj(source.nutrition);
  const from = nested ?? source;

  const calories = readMacroValue(from, ["calories", "kcal", "energy"]);
  const protein_g = readMacroValue(from, ["protein_g", "proteinG", "protein", "proteinGrams"]);
  const carbs_g = readMacroValue(from, ["carbs_g", "carbsG", "carbs", "carbohydrates", "carbGrams"]);
  const fat_g = readMacroValue(from, ["fat_g", "fatG", "fat", "fatGrams"]);

  if (calories == null && protein_g == null && carbs_g == null && fat_g == null) return null;
  return { calories, protein_g, carbs_g, fat_g };
}

function normalizeMealOption(raw: AnyObj, index: number, isCustom: boolean): NormalizedMealOption | null {
  const mealSlot =
    (typeof raw.meal === "string" && raw.meal.trim()) ||
    (typeof raw.mealSlot === "string" && raw.mealSlot.trim()) ||
    (typeof raw.slot === "string" && raw.slot.trim()) ||
    (typeof raw.mealType === "string" && raw.mealType.trim()) ||
    "";

  const name =
    (typeof raw.name === "string" && raw.name.trim()) ||
    (typeof raw.title === "string" && raw.title.trim()) ||
    "Meal option";

  if (!mealSlot && !name) return null;

  return {
    id: String(raw.mealId ?? raw.id ?? `${isCustom ? "custom" : "meal"}-${index}`),
    mealSlot: mealSlot || "Other",
    option: raw.option != null ? String(raw.option) : null,
    name,
    whyThisMeal: typeof raw.whyThisMeal === "string" ? raw.whyThisMeal : null,
    macros: normalizeMealMacros(raw),
    ingredients: asList(raw.ingredients).map((x) => asObj(x)).filter((x): x is AnyObj => Boolean(x)),
    method: asList(raw.method).filter((x): x is string => typeof x === "string"),
    isCustom,
  };
}

/** Collect standard + custom meal entries from supported JSON shapes. */
export function collectMealPlanOptions(plan: AnyObj): NormalizedMealOption[] {
  const buckets: { items: unknown[]; isCustom: boolean }[] = [
    { items: asList(plan.meals), isCustom: false },
    { items: asList(plan.customMeals), isCustom: true },
    { items: asList(plan.custom_meals), isCustom: true },
    { items: asList(plan.clientMeals), isCustom: true },
  ];

  const options: NormalizedMealOption[] = [];
  let index = 0;
  for (const bucket of buckets) {
    for (const item of bucket.items) {
      const obj = asObj(item);
      if (!obj) continue;
      const normalized = normalizeMealOption(obj, index++, bucket.isCustom);
      if (normalized) options.push(normalized);
    }
  }
  return options;
}

function breakdownTargets(row: AnyObj): MealPlanMacros | null {
  const calories = readMacroValue(row, ["targetCalories", "calories", "kcal"]);
  const protein_g = readMacroValue(row, ["targetProtein_g", "targetProteinG", "protein_g", "protein"]);
  const carbs_g = readMacroValue(row, ["targetCarbs_g", "targetCarbsG", "carbs_g", "carbs"]);
  const fat_g = readMacroValue(row, ["targetFat_g", "targetFatG", "fat_g", "fat"]);
  if (calories == null && protein_g == null && carbs_g == null && fat_g == null) return null;
  return { calories, protein_g, carbs_g, fat_g };
}

/** Group meal options under schedule slots (breakfast, lunch, etc.) with macro targets. */
export function groupMealPlanBySlot(plan: AnyObj): MealSlotGroup[] {
  const options = collectMealPlanOptions(plan);
  const mealSchedule = asObj(plan.mealSchedule);
  const breakdown = asList(mealSchedule?.breakdown).map((x) => asObj(x)).filter((x): x is AnyObj => Boolean(x));

  const groups = new Map<string, MealSlotGroup>();
  const ensureGroup = (label: string, seed?: Partial<MealSlotGroup>) => {
    const key = normalizeMealKey(label);
    const existing = groups.get(key);
    if (existing) return existing;
    const group: MealSlotGroup = {
      key,
      label,
      splitPct: seed?.splitPct ?? null,
      suggestedTime: seed?.suggestedTime ?? null,
      targets: seed?.targets ?? null,
      options: [],
    };
    groups.set(key, group);
    return group;
  };

  for (const row of breakdown) {
    const label = typeof row.meal === "string" && row.meal.trim() ? row.meal.trim() : "Meal";
    ensureGroup(label, {
      splitPct: row.splitPct as number | string | null,
      suggestedTime: typeof row.suggestedTime === "string" ? row.suggestedTime : null,
      targets: breakdownTargets(row),
    });
  }

  for (const option of options) {
    const group = ensureGroup(option.mealSlot);
    group.options.push(option);
  }

  const ordered: MealSlotGroup[] = [];
  const used = new Set<string>();

  for (const row of breakdown) {
    const label = typeof row.meal === "string" && row.meal.trim() ? row.meal.trim() : "";
    if (!label) continue;
    const key = normalizeMealKey(label);
    const group = groups.get(key);
    if (group) {
      ordered.push(group);
      used.add(key);
    }
  }

  for (const group of groups.values()) {
    if (!used.has(group.key)) ordered.push(group);
  }

  return ordered.filter((g) => g.options.length > 0 || g.targets != null);
}

export function formatMacroTargets(targets: MealPlanMacros | null): string | null {
  if (!targets) return null;
  const parts: string[] = [];
  if (targets.calories != null) parts.push(`${targets.calories} cal`);
  if (targets.protein_g != null) parts.push(`${targets.protein_g} g protein`);
  if (targets.carbs_g != null) parts.push(`${targets.carbs_g} g carbs`);
  if (targets.fat_g != null) parts.push(`${targets.fat_g} g fat`);
  return parts.length ? parts.join(" · ") : null;
}

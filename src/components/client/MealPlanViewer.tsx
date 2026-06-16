"use client";

import { Card } from "@/components/ui/Card";
import {
  formatMacroTargets,
  groupMealPlanBySlot,
  type MealPlanMacros,
  type NormalizedMealOption,
} from "@/lib/meal-plan-view";

type AnyObj = Record<string, unknown>;

function asObj(v: unknown): AnyObj | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as AnyObj) : null;
}

function asList(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function labelize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function renderValue(v: unknown): string {
  if (v == null) return "-";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Ordered labels for `weightGuidance` JSON keys (camelCase). */
const WEIGHT_GUIDANCE_FIELDS: { key: string; label: string }[] = [
  { key: "proteins", label: "Proteins" },
  { key: "eggWhites", label: "Egg whites" },
  { key: "grains", label: "Grains" },
  { key: "tinnedFoods", label: "Tinned foods" },
  { key: "vegetables", label: "Vegetables" },
  { key: "fruit", label: "Fruit" },
  { key: "oilsAndSpreads", label: "Oils and spreads" },
];

function MacroGrid({ obj }: { obj: AnyObj | MealPlanMacros }) {
  const entries = Object.entries(obj).filter(([, v]) => v != null && v !== "");
  if (!entries.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
          <p className="text-xs text-[var(--color-text-muted)]">{labelize(k)}</p>
          <p className="text-sm font-semibold text-[var(--color-text)]">{renderValue(v)}</p>
        </div>
      ))}
    </div>
  );
}

function MealOptionCard({ meal }: { meal: NormalizedMealOption }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
          {meal.option ? `Option ${meal.option}` : "Meal option"}
        </p>
        {meal.isCustom && (
          <span className="rounded-full bg-[var(--color-accent-muted)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-accent)]">
            Custom
          </span>
        )}
      </div>
      <h3 className="mt-1 text-base font-semibold text-[var(--color-text)]">{meal.name}</h3>
      {meal.whyThisMeal && (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{meal.whyThisMeal}</p>
      )}
      {meal.macros && (
        <div className="mt-3">
          <MacroGrid obj={meal.macros} />
        </div>
      )}
      {meal.ingredients.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-[var(--color-text)]">Ingredients</p>
          <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            {meal.ingredients.map((ing, idx) => {
              const notePart = ing.note != null && String(ing.note).trim() ? ` (${String(ing.note).trim()})` : "";
              const showWeightType = nonEmptyString(ing.weightType);
              return (
                <li key={idx} className="leading-snug">
                  <div>
                    <span className="text-[var(--color-text)]">{renderValue(ing.item)}</span>
                    <span className="text-[var(--color-text-secondary)]">
                      {" "}
                      — {renderValue(ing.qty)} {renderValue(ing.unit)}
                      {notePart}
                    </span>
                  </div>
                  {showWeightType && (
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      Weight: {String(ing.weightType).trim()}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {meal.method.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-[var(--color-text)]">Method</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--color-text-secondary)]">
            {meal.method.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export function MealPlanViewer({ plan }: { plan: AnyObj }) {
  const title = typeof plan.title === "string" ? plan.title : "Meal plan";
  const createdAt = typeof plan.createdAt === "string" ? plan.createdAt : null;
  const notes = typeof plan.notes === "string" ? plan.notes : null;

  const dailyTargets = asObj(plan.dailyTargets);
  const weightGuidance = asObj(plan.weightGuidance);
  const hasWeightGuidanceSection =
    weightGuidance != null &&
    (nonEmptyString(weightGuidance.defaultRule) ||
      WEIGHT_GUIDANCE_FIELDS.some(({ key }) => nonEmptyString(weightGuidance[key])));

  const mealSchedule = asObj(plan.mealSchedule);
  const mealBreakdown = asList(mealSchedule?.breakdown);
  const mealRules = asList(plan.mealRules).filter((x): x is string => typeof x === "string");
  const mealSlotGroups = groupMealPlanBySlot(plan);
  const shoppingList = asObj(plan.shoppingList);
  const supplementSchedule = asObj(plan.supplementSchedule);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">{title}</h1>
        {createdAt && <p className="mt-1 text-sm text-[var(--color-text-muted)]">Created: {createdAt}</p>}
        {notes && <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{notes}</p>}
      </Card>

      {dailyTargets && (
        <Card className="p-6">
          <h2 className="mb-3 text-lg font-medium text-[var(--color-text)]">Daily targets</h2>
          <MacroGrid obj={dailyTargets} />
        </Card>
      )}

      {hasWeightGuidanceSection && weightGuidance && (
        <Card className="p-6">
          <h2 className="mb-3 text-lg font-medium text-[var(--color-text)]">Weight guidance</h2>
          {nonEmptyString(weightGuidance.defaultRule) && (
            <p
              className={`text-sm leading-relaxed text-[var(--color-text-secondary)] ${
                WEIGHT_GUIDANCE_FIELDS.some(({ key }) => nonEmptyString(weightGuidance[key])) ? "mb-4" : ""
              }`}
            >
              {String(weightGuidance.defaultRule).trim()}
            </p>
          )}
          {WEIGHT_GUIDANCE_FIELDS.some(({ key }) => nonEmptyString(weightGuidance[key])) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {WEIGHT_GUIDANCE_FIELDS.map(({ key, label }) => {
                const text = weightGuidance[key];
                if (!nonEmptyString(text)) return null;
                return (
                  <div
                    key={key}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2"
                  >
                    <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{text.trim()}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {mealBreakdown.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-3 text-lg font-medium text-[var(--color-text)]">Meal timing and split</h2>
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-[var(--color-bg-elevated)]">
                <tr className="border-b border-[var(--color-border)]">
                  {["Meal", "Split", "Calories", "Protein", "Carbs", "Fat", "Suggested time"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mealBreakdown.map((row, i) => {
                  const r = asObj(row) ?? {};
                  return (
                    <tr key={i} className="border-b border-[var(--color-border)] last:border-b-0">
                      <td className="px-3 py-2 text-[var(--color-text)]">{renderValue(r.meal)}</td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">{renderValue(r.splitPct)}%</td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">{renderValue(r.targetCalories)}</td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">{renderValue(r.targetProtein_g)} g</td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">{renderValue(r.targetCarbs_g)} g</td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">{renderValue(r.targetFat_g)} g</td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">{renderValue(r.suggestedTime)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {mealRules.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-3 text-lg font-medium text-[var(--color-text)]">Meal rules</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-text-secondary)]">
            {mealRules.map((rule, i) => (
              <li key={i}>{rule}</li>
            ))}
          </ul>
        </Card>
      )}

      {mealSlotGroups.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--color-text)]">Meal options</h2>
          {mealSlotGroups.map((slot) => {
            const targetSummary = formatMacroTargets(slot.targets);
            return (
              <Card key={slot.key} className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] pb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--color-text)]">{slot.label}</h3>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--color-text-muted)]">
                      {slot.splitPct != null && <span>{renderValue(slot.splitPct)}% of daily intake</span>}
                      {slot.suggestedTime && <span>Suggested: {slot.suggestedTime}</span>}
                    </div>
                  </div>
                  {targetSummary && (
                    <p className="text-sm font-medium text-[var(--color-accent)]">Target: {targetSummary}</p>
                  )}
                </div>
                {slot.targets && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                      Slot targets
                    </p>
                    <MacroGrid obj={slot.targets} />
                  </div>
                )}
                {slot.options.length > 0 ? (
                  <div className={`space-y-3 ${slot.targets ? "mt-4" : "mt-4"}`}>
                    {slot.options.map((meal) => (
                      <MealOptionCard key={meal.id} meal={meal} />
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[var(--color-text-muted)]">No meal options added for this slot yet.</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {shoppingList && (
        <Card className="p-6">
          <h2 className="mb-3 text-lg font-medium text-[var(--color-text)]">Shopping list</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(shoppingList).map(([group, items]) => {
              const list = asList(items).filter((x): x is string => typeof x === "string");
              if (!list.length) return null;
              return (
                <div key={group} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                  <p className="mb-2 text-sm font-medium text-[var(--color-text)]">{labelize(group)}</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-text-secondary)]">
                    {list.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {supplementSchedule && (
        <Card className="p-6">
          <h2 className="mb-3 text-lg font-medium text-[var(--color-text)]">Supplement schedule</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(supplementSchedule).map(([slot, entries]) => {
              const list = asList(entries).filter((x): x is string => typeof x === "string");
              if (!list.length) return null;
              return (
                <div key={slot} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                  <p className="mb-2 text-sm font-medium text-[var(--color-text)]">{labelize(slot)}</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-text-secondary)]">
                    {list.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

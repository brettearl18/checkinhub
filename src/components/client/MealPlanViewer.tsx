"use client";

import { Card } from "@/components/ui/Card";

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

function MacroGrid({ obj }: { obj: AnyObj }) {
  const entries = Object.entries(obj);
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

export function MealPlanViewer({ plan }: { plan: AnyObj }) {
  const title = typeof plan.title === "string" ? plan.title : "Meal plan";
  const createdAt = typeof plan.createdAt === "string" ? plan.createdAt : null;
  const notes = typeof plan.notes === "string" ? plan.notes : null;

  const dailyTargets = asObj(plan.dailyTargets);
  const mealSchedule = asObj(plan.mealSchedule);
  const mealBreakdown = asList(mealSchedule?.breakdown);
  const mealRules = asList(plan.mealRules).filter((x): x is string => typeof x === "string");
  const meals = asList(plan.meals).map((m) => asObj(m)).filter((m): m is AnyObj => Boolean(m));
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

      {meals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--color-text)]">Meal options</h2>
          {meals.map((m, i) => {
            const ingredients = asList(m.ingredients).map((x) => asObj(x)).filter((x): x is AnyObj => Boolean(x));
            const method = asList(m.method).filter((x): x is string => typeof x === "string");
            const macros = asObj(m.macros);
            return (
              <Card key={String(m.mealId ?? i)} className="p-6">
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  {String(m.meal ?? "")} {m.option ? `Option ${String(m.option)}` : ""}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">{String(m.name ?? "Meal option")}</h3>
                {typeof m.whyThisMeal === "string" && (
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{m.whyThisMeal}</p>
                )}
                {macros && (
                  <div className="mt-3">
                    <MacroGrid obj={macros} />
                  </div>
                )}
                {ingredients.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-medium text-[var(--color-text)]">Ingredients</p>
                    <ul className="space-y-1 text-sm text-[var(--color-text-secondary)]">
                      {ingredients.map((ing, idx) => (
                        <li key={idx}>
                          {renderValue(ing.item)} - {renderValue(ing.qty)} {renderValue(ing.unit)}
                          {ing.note ? ` (${String(ing.note)})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {method.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-medium text-[var(--color-text)]">Method</p>
                    <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--color-text-secondary)]">
                      {method.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
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

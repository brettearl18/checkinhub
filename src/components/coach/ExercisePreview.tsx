"use client";

import { Card } from "@/components/ui/Card";

function getYouTubeEmbedUrl(url: string): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url.trim());
    if (u.hostname.replace("www.", "") === "youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      const shorts = u.pathname.match(/\/shorts\/([^/?]+)/);
      if (shorts) return `https://www.youtube.com/embed/${shorts[1]}`;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch {
    // ignore
  }
  return null;
}

interface ExercisePreviewProps {
  name: string;
  description: string;
  category: string;
  equipment: string;
  primaryMuscleGroups: string[];
  secondaryMuscleGroups: string[];
  videoUrl: string;
  imageUrl: string;
  difficulty?: string;
  movementPattern?: string;
  bodyRegion?: string;
  isUnilateral?: boolean;
  isCompound?: boolean;
  coachingCues?: string[];
  commonMistakes?: string[];
  regressionOptions?: string[];
  progressionOptions?: string[];
  startingPosition?: string;
  tempo?: string;
  rangeOfMotionNotes?: string;
  safetyNotes?: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[var(--color-bg)] p-3 ring-1 ring-[var(--color-border)]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
        {title}
      </p>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="list-inside list-disc text-sm text-[var(--color-text-secondary)] space-y-0.5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function ExercisePreview({
  name,
  description,
  category,
  equipment,
  primaryMuscleGroups,
  secondaryMuscleGroups,
  videoUrl,
  imageUrl,
  difficulty,
  movementPattern,
  bodyRegion,
  isUnilateral,
  isCompound,
  coachingCues,
  commonMistakes,
  regressionOptions,
  progressionOptions,
  startingPosition,
  tempo,
  rangeOfMotionNotes,
  safetyNotes,
}: ExercisePreviewProps) {
  const youtubeEmbed = getYouTubeEmbedUrl(videoUrl);
  const hasMedia = youtubeEmbed || (imageUrl && imageUrl.trim());

  return (
    <Card className="overflow-hidden rounded-xl border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-0 shadow-sm">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
        <span className="inline-flex h-2 w-2 rounded-full bg-[var(--color-primary)]" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
          Live preview
        </span>
      </div>
      <div className="p-5 space-y-5 max-h-[min(80vh,800px)] overflow-y-auto">
        {!name.trim() && !description.trim() && !category && !equipment && primaryMuscleGroups.length === 0 && secondaryMuscleGroups.length === 0 && !hasMedia && (
          <p className="text-sm text-[var(--color-text-muted)] italic">
            Fill in the form to see how the exercise will look.
          </p>
        )}

        {(name.trim() || hasMedia) && (
          <>
            {hasMedia ? (
              <div className="space-y-3">
                <div className="flex gap-4">
                  <div className="relative h-[83px] w-[146px] flex-shrink-0 overflow-hidden rounded-lg bg-[var(--color-bg)] shadow-inner ring-1 ring-[var(--color-border)]">
                    {youtubeEmbed ? (
                      <iframe
                        src={youtubeEmbed}
                        title="Exercise video"
                        className="absolute inset-0 h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : imageUrl?.trim() ? (
                      <img
                        src={imageUrl.trim()}
                        alt="Exercise"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  {name.trim() && (
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl font-semibold tracking-tight text-[var(--color-text)]">
                        {name.trim() || "Untitled exercise"}
                      </h3>
                    </div>
                  )}
                </div>
                {(category || equipment || difficulty || movementPattern || bodyRegion || isUnilateral || isCompound || primaryMuscleGroups.length > 0 || secondaryMuscleGroups.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {category && (
                      <span className="rounded-full bg-[var(--color-primary-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary)]">
                        {category}
                      </span>
                    )}
                    {equipment && (
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
                        {equipment}
                      </span>
                    )}
                    {difficulty && (
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
                        {difficulty}
                      </span>
                    )}
                    {movementPattern && (
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
                        {movementPattern}
                      </span>
                    )}
                    {bodyRegion && (
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-muted)]">
                        {bodyRegion}
                      </span>
                    )}
                    {isUnilateral && (
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-muted)]">
                        Unilateral
                      </span>
                    )}
                    {isCompound && (
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-muted)]">
                        Compound
                      </span>
                    )}
                    {primaryMuscleGroups.map((m) => (
                      <span
                        key={`p-${m}`}
                        className="rounded-md bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] ring-1 ring-[var(--color-border)]"
                      >
                        {m}
                      </span>
                    ))}
                    {secondaryMuscleGroups.map((m) => (
                      <span
                        key={`s-${m}`}
                        className="rounded-md bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-muted)] ring-1 ring-[var(--color-border)]"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {name.trim() && (
                  <h3 className="text-xl font-semibold tracking-tight text-[var(--color-text)]">
                    {name.trim() || "Untitled exercise"}
                  </h3>
                )}
                {(category || equipment || difficulty || movementPattern || bodyRegion || isUnilateral || isCompound || primaryMuscleGroups.length > 0 || secondaryMuscleGroups.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {category && (
                      <span className="rounded-full bg-[var(--color-primary-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary)]">
                        {category}
                      </span>
                    )}
                    {equipment && (
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
                        {equipment}
                      </span>
                    )}
                    {difficulty && (
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
                        {difficulty}
                      </span>
                    )}
                    {movementPattern && (
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
                        {movementPattern}
                      </span>
                    )}
                    {bodyRegion && (
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-muted)]">
                        {bodyRegion}
                      </span>
                    )}
                    {isUnilateral && (
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-muted)]">
                        Unilateral
                      </span>
                    )}
                    {isCompound && (
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-muted)]">
                        Compound
                      </span>
                    )}
                    {primaryMuscleGroups.map((m) => (
                      <span
                        key={`p-${m}`}
                        className="rounded-md bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] ring-1 ring-[var(--color-border)]"
                      >
                        {m}
                      </span>
                    ))}
                    {secondaryMuscleGroups.map((m) => (
                      <span
                        key={`s-${m}`}
                        className="rounded-md bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text-muted)] ring-1 ring-[var(--color-border)]"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {description.trim() && (
              <Section title="Instructions">
                <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap line-clamp-6">
                  {description.trim()}
                </p>
              </Section>
            )}

            {(startingPosition || tempo) && (
              <div className="flex flex-wrap gap-3 text-sm text-[var(--color-text-secondary)]">
                {startingPosition && (
                  <span><strong className="text-[var(--color-text-muted)]">Start:</strong> {startingPosition}</span>
                )}
                {tempo && (
                  <span><strong className="text-[var(--color-text-muted)]">Tempo:</strong> {tempo}</span>
                )}
              </div>
            )}

            {coachingCues?.length ? (
              <Section title="Coaching cues">
                <BulletList items={coachingCues} />
              </Section>
            ) : null}

            {commonMistakes?.length ? (
              <Section title="Common mistakes">
                <BulletList items={commonMistakes} />
              </Section>
            ) : null}

            {rangeOfMotionNotes?.trim() && (
              <Section title="Range of motion">
                <p className="text-sm text-[var(--color-text-secondary)]">{rangeOfMotionNotes.trim()}</p>
              </Section>
            )}

            {(regressionOptions?.length || progressionOptions?.length) ? (
              <Section title="Scaling">
                {regressionOptions?.length ? (
                  <p className="text-sm text-[var(--color-text-secondary)] mb-1">
                    <strong className="text-[var(--color-text-muted)]">Easier:</strong> {regressionOptions.join(" · ")}
                  </p>
                ) : null}
                {progressionOptions?.length ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    <strong className="text-[var(--color-text-muted)]">Harder:</strong> {progressionOptions.join(" · ")}
                  </p>
                ) : null}
              </Section>
            ) : null}

            {safetyNotes?.trim() && (
              <Section title="Safety notes">
                <p className="text-sm text-[var(--color-text-secondary)]">{safetyNotes.trim()}</p>
              </Section>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

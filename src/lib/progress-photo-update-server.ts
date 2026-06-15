import type { Firestore } from "firebase-admin/firestore";
import {
  isProgressPhotoDateInFuture,
  parseProgressPhotoDateString,
} from "@/lib/progress-photo-dates";
import { isAllowedProgressPhotoImageType } from "@/lib/progress-photo-types";

function toIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  return null;
}

export interface ProgressPhotoUpdateInput {
  imageType?: string;
  photoDate?: string;
  caption?: string | null;
}

export interface ProgressPhotoUpdateResult {
  id: string;
  imageType: string | null;
  caption: string | null;
  uploadedAt: string | null;
}

export async function updateProgressImageMetadata(
  db: Firestore,
  imageId: string,
  input: ProgressPhotoUpdateInput
): Promise<{ ok: true; photo: ProgressPhotoUpdateResult } | { ok: false; error: string; status: number }> {
  const ref = db.collection("progress_images").doc(imageId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, error: "Photo not found", status: 404 };
  }

  const hasType = input.imageType !== undefined;
  const hasDate = input.photoDate !== undefined;
  const hasCaption = input.caption !== undefined;
  if (!hasType && !hasDate && !hasCaption) {
    return { ok: false, error: "Provide imageType, photoDate, and/or caption to update", status: 400 };
  }

  const payload: Record<string, unknown> = { updatedAt: new Date() };

  if (hasType) {
    const imageType = input.imageType!.trim();
    if (!isAllowedProgressPhotoImageType(imageType)) {
      return { ok: false, error: "Invalid image type", status: 400 };
    }
    payload.imageType = imageType;
    if (imageType.startsWith("before_")) {
      payload.importedBeforeCheckinHUB = true;
    }
  }

  if (hasDate) {
    const photoDateKey = input.photoDate!.trim();
    const parsed = parseProgressPhotoDateString(photoDateKey);
    if (!parsed) {
      return { ok: false, error: "photoDate must be YYYY-MM-DD", status: 400 };
    }
    if (isProgressPhotoDateInFuture(photoDateKey)) {
      return { ok: false, error: "Photo date cannot be in the future", status: 400 };
    }
    payload.uploadedAt = parsed;
  }

  if (hasCaption) {
    const caption = input.caption;
    payload.caption = typeof caption === "string" && caption.trim() ? caption.trim() : null;
  }

  await ref.update(payload);

  const updated = await ref.get();
  const data = updated.data()!;
  return {
    ok: true,
    photo: {
      id: imageId,
      imageType: (data.imageType as string | null) ?? null,
      caption: (data.caption as string | null) ?? null,
      uploadedAt: toIso(data.uploadedAt),
    },
  };
}

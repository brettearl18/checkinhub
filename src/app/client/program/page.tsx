import { redirect } from "next/navigation";
import { WORKOUTS_HUB_URL } from "@/lib/workouts-hub";

/** Program lives in the workouts app — keep this route for bookmarks and old links. */
export default function ClientProgramPage() {
  redirect(WORKOUTS_HUB_URL);
}

import { redirect } from "next/navigation";

export default async function CoachClientProgress2Redirect({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  redirect(`/coach/clients/${clientId}/progress`);
}

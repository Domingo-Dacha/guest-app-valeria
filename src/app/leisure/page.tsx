import { AppShell } from "@/components/domingo/app-shell";
import { LeisureExperience } from "@/components/domingo/leisure-experience";
import type { Season } from "@/data/contracts/activity";
import { fixtureActivityRepository } from "@/data/repositories/fixture-activity-repository";
import { fixtureCatalogRepository } from "@/data/repositories/fixture-catalog-repository";
import { requirePageSession } from "@/lib/auth/server-session";

export const dynamic = "force-dynamic";

function seasonForDate(date: string): Season {
  const month = Number(date.slice(5, 7));
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export default async function LeisurePage() {
  await requirePageSession();
  const [activities, booking] = await Promise.all([
    fixtureActivityRepository.listActive(),
    fixtureCatalogRepository.getDemoBooking(),
  ]);
  return (
    <AppShell>
      <LeisureExperience
        activities={activities}
        initialSeason={seasonForDate(booking.checkIn)}
      />
    </AppShell>
  );
}

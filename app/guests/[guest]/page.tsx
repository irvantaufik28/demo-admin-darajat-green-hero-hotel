import { GuestDetailPage } from "../../../features/guests/components/GuestDetailPage";

export default async function Page({ params }: { params: Promise<{ guest: string }> }) {
  const { guest } = await params;
  return <GuestDetailPage guestKey={guest} />;
}

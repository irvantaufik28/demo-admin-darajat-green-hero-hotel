import { RoleDetailPage } from "../../../../features/settings/components/RoleDetailPage";

export default async function Page({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  return <RoleDetailPage slug={role} />;
}

import { RoleDetailPage } from "../../../../components/settings/RoleDetailPage";

export default async function Page({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  return <RoleDetailPage slug={role} />;
}

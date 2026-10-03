import { MasterListPage } from "../../../features/master/components/MasterListPage";

export default async function Page({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  return <MasterListPage categorySlug={category} />;
}

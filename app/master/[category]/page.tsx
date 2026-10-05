import { MasterListPage } from "../../../features/master/components/MasterListPage";
import { CapacityPatternsPage } from "../../../features/master/components/CapacityPatternsPage";

export default async function Page({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (category === "capacity-patterns") return <CapacityPatternsPage />;
  return <MasterListPage categorySlug={category} />;
}

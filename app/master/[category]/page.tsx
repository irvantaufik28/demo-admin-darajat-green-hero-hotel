import { MasterListPage } from "../../../features/master/pages/MasterListPage";
import { CapacityPatternsPage } from "../../../features/master/pages/CapacityPatternsPage";

export default async function Page({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (category === "capacity-patterns") return <CapacityPatternsPage />;
  return <MasterListPage categorySlug={category} />;
}

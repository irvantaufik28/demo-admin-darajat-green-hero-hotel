import { notFound } from "next/navigation";
import { CampaignForm } from "../../../../components/campaigns/CampaignForm";
import { getCampaignById } from "../../../../lib/campaigns-data";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditCampaignPage({ params }: Props) {
  const { id } = await params;
  const campaign = getCampaignById(id);

  if (!campaign) {
    notFound();
  }

  return <CampaignForm mode="edit" initialData={campaign} />;
}

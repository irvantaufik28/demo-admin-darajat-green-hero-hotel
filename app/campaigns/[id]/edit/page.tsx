import { notFound } from "next/navigation";
import { CampaignForm } from "../../../../features/campaigns/components/CampaignForm";
import { getCampaignById } from "../../../../features/campaigns/constants/campaigns-data";

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

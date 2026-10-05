import { CampaignForm } from "../../../../features/campaigns/components/CampaignForm";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditCampaignPage({ params }: Props) {
  const { id } = await params;
  return <CampaignForm mode="edit" campaignId={id} />;
}

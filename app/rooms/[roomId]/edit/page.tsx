import { AddRoomTypePage } from "../../../../features/rooms/components/AddRoomTypePage";

export default async function EditRoomTypePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <AddRoomTypePage roomId={roomId} />;
}

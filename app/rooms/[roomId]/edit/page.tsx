import { AddRoomTypePage } from "../../../../features/rooms/pages/AddRoomTypePage";

export default async function EditRoomTypePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <AddRoomTypePage roomId={roomId} />;
}

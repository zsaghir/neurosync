import { GuidedCheckIn } from "@/components/checkins/GuidedCheckIn";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function CheckInScreen() {
  const params = useLocalSearchParams<{ taskId?: string; taskTitle?: string }>();
  const router = useRouter();
  const taskId = typeof params.taskId === "string" ? params.taskId : undefined;
  const taskTitle = typeof params.taskTitle === "string" ? params.taskTitle : undefined;

  return (
    <GuidedCheckIn
      mode="modal"
      taskId={taskId}
      taskTitle={taskTitle}
      onClose={() => router.back()}
    />
  );
}

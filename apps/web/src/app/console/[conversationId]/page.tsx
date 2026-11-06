"use client";

import { useParams } from "next/navigation";
import { ConversationView } from "@/features/console/conversation-view";

export default function ConsoleConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  return <ConversationView key={conversationId} conversationId={conversationId} />;
}
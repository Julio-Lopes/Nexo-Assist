import type { Metadata } from "next";
import { ChatScreen } from "@/features/chat/chat-screen";

export const metadata: Metadata = { title: "Atendimento" };

export default function ChatPage() {
  return <ChatScreen />;
}
import type { Metadata } from "next";
import { LoginScreen } from "@/features/login/login-screen";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return <LoginScreen />;
}
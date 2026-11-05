"use client";

import { KeyRound, Lock, Mail, RotateCcwKey } from "lucide-react";
import { useState } from "react";
import { TopBar } from "@/components/shell/top-bar";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth";

function Row({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 px-6 py-5 sm:flex-row sm:items-center sm:gap-4 ${last ? "" : "border-b border-rule"}`}>
      <span className="w-40 shrink-0 text-[13.5px] text-ink-3">{label}</span>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">{children}</div>
    </div>
  );
}

export default function ProfilePage() {
  const user = useCurrentUser();
  const [showReset, setShowReset] = useState(false);

  return (
    <>
      <TopBar title="Meu perfil" />
      <div className="flex-1 overflow-y-auto px-4 py-10 sm:px-10 sm:py-12">
        <div className="mx-auto flex max-w-[600px] flex-col gap-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-[-0.4px]">Meu perfil</h1>
            <p className="text-[14.5px] text-ink-3">Seus dados de acesso ao service desk de TI.</p>
          </div>

          <section className="overflow-hidden rounded-2xl border border-ink/9 bg-paper shadow-card">
            <Row label="Nome">
              <span className="text-[14.5px] font-medium">{user.name}</span>
            </Row>
            <Row label="Área">
              <span className="text-[14.5px] font-medium">{user.department}</span>
            </Row>
            <Row label="Equipamento">
              <span className="text-[14.5px] font-medium">{user.device ?? "Não informado"}</span>
            </Row>
            <Row label="E-mail corporativo" last>
              <span className="truncate text-[14.5px] font-medium">{user.email}</span>
              <span className="flex shrink-0 items-center gap-1.5 text-[12.5px] text-ink-3">
                <Lock aria-hidden className="size-[13px]" />
                Gerenciado pela TI
              </span>
            </Row>
          </section>

          <section className="overflow-hidden rounded-2xl border border-ink/9 bg-paper shadow-card">
            <div className="flex flex-wrap items-center gap-4 p-6">
              <div className="flex size-10 items-center justify-center rounded-full bg-desk">
                <KeyRound aria-hidden className="size-[18px] text-ink-2" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold">Senha</p>
                <p className="text-[13.5px] text-ink-3">A mesma da rede Nexo (e-mail, VPN e computador).</p>
              </div>
              <Button onClick={() => setShowReset((v) => !v)} aria-expanded={showReset}>
                <RotateCcwKey aria-hidden className="size-[15px] text-ink-2" />
                Redefinir senha
              </Button>
            </div>
            {showReset && (
              <div className="flex items-center gap-2 border-t border-rule bg-desk px-6 py-3 text-[13px] text-ink-3">
                <Mail aria-hidden className="size-3.5 shrink-0" />
                Redefina em senha.nexo.com.br com o código enviado ao seu celular cadastrado.
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
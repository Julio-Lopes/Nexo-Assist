"use client";

import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api-client";
import { homeFor, useLogin, useSession } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { Showcase } from "./showcase";

const DEMO_ACCOUNTS = [
  { label: "Ana Souza · funcionária", email: "ana.souza@nexo.com.br" },
  { label: "Bruno Tavares · funcionário", email: "bruno.tavares@nexo.com.br" },
  { label: "Rafael Lima · analista N2", email: "rafael.lima@nexo.com.br" },
];

const inputBox =
  "flex h-11 items-center gap-2.5 rounded-lg border bg-paper pr-2 pl-3.5 shadow-control transition-colors focus-within:border-cta focus-within:ring-1 focus-within:ring-cta";

export function LoginScreen() {
  const router = useRouter();
  const session = useSession();
  const login = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [hint, setHint] = useState<string | null>(null);

  // Já autenticado: vai direto para a área certa.
  useEffect(() => {
    if (session.data) router.replace(homeFor(session.data));
  }, [session.data, router]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setHint(null);
    login.mutate({ email, password, remember }, { onSuccess: (user) => router.replace(homeFor(user)) });
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("demo");
    setHint(null);
    login.reset();
  }

  const error = login.isError ? errorMessage(login.error, "Não foi possível entrar.") : null;

  return (
    <main className="grid min-h-dvh bg-paper lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <Showcase />

      <section className="flex flex-col justify-between px-6 py-8 sm:px-14 sm:py-10">
        <p className="flex items-center justify-end gap-1.5 text-[13.5px]">
          <span className="text-ink-3">Problema para entrar?</span>
          <span className="font-semibold text-primary-text">Ligue no ramal 4000</span>
        </p>

        <div className="flex justify-center py-10">
          <form onSubmit={handleSubmit} noValidate className="flex w-full max-w-[380px] flex-col gap-7">
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-[40px] leading-[1.1] tracking-[-0.8px]">Entrar</h2>
              <p className="text-[15.5px] leading-normal text-ink-3">Use seu e-mail corporativo e a senha da rede Nexo.</p>
            </div>

            <div className="flex flex-col gap-[18px]">
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-[13.5px] font-medium">
                  E-mail corporativo
                </label>
                <div className={cn(inputBox, error ? "border-danger" : "border-line")}>
                  <Mail aria-hidden className="size-4 shrink-0 text-ink-3" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="nome.sobrenome@nexo.com.br"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(error) || undefined}
                    className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-ink-3/70"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-[13.5px] font-medium">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => setHint("Redefina pelo portal senha.nexo.com.br, com o código enviado ao seu celular cadastrado.")}
                    className="text-[13.5px] font-medium text-primary-text hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className={cn(inputBox, error ? "border-danger" : "border-line")}>
                  <LockKeyhole aria-hidden className="size-4 shrink-0 text-ink-3" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={Boolean(error) || undefined}
                    className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="flex size-[30px] items-center justify-center rounded-md text-ink-3 hover:bg-desk"
                  >
                    {showPassword ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-[9px] pt-0.5 text-[13.5px] text-ink-2">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className="flex size-[18px] items-center justify-center rounded-md border border-line bg-paper peer-checked:border-cta peer-checked:bg-cta peer-focus-visible:outline-2 peer-focus-visible:outline-primary"
                >
                  {remember && <Check className="size-3 text-white" strokeWidth={3} />}
                </span>
                Manter conectado neste computador
              </label>
            </div>

            {(error || hint) && (
              <p
                role={error ? "alert" : "status"}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-[13.5px] leading-normal",
                  error ? "bg-danger-soft text-danger-text" : "bg-desk text-ink-2",
                )}
              >
                {error ?? hint}
              </p>
            )}

            <Button type="submit" variant="primary" size="lg" loading={login.isPending} disabled={!email || !password}>
              Entrar
              {!login.isPending && <ArrowRight aria-hidden className="size-4" />}
            </Button>

            <div className="flex flex-col gap-2.5 border-t border-rule pt-4">
              <p className="text-[12.5px] font-medium text-ink-3">Acesso de demonstração (qualquer senha)</p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => fillDemo(account.email)}
                    className="rounded-full bg-desk px-3 py-1 text-[12.5px] text-ink-2 transition-colors hover:bg-primary-soft hover:text-primary-text"
                  >
                    {account.label}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>

        <footer className="flex flex-wrap justify-between gap-2 text-[12.5px] text-ink-3">
          <span>© 2026 Nexo · Service desk de TI</span>
          <span>Privacidade e uso de dados</span>
        </footer>
      </section>
    </main>
  );
}
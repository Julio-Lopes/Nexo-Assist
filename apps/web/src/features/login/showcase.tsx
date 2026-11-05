import { NexoMark } from "@/components/brand/nexo-mark";

function ConversationPreview() {
  return (
    <div className="flex w-full max-w-[500px] flex-col gap-2.5 rounded-2xl border border-white/8 bg-white/4 p-[18px]">
      <div className="flex justify-end">
        <p className="rounded-[12px_12px_4px_12px] bg-paper px-3.5 py-[9px] text-[13.5px] text-ink">
          Meu notebook não conecta na VPN. Erro 809.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-1.5 text-[12.5px]">
          <span className="font-semibold text-white/80">Nexo Assist</span>
          <span className="text-white/45">consultou seus chamados · criou um chamado</span>
        </p>
        <p className="max-w-[380px] rounded-[4px_12px_12px_12px] bg-white/8 px-3.5 py-2.5 text-[13.5px] leading-normal text-white">
          Pronto: abri o chamado com prioridade alta. Um analista fala com você em até 4 h úteis.
        </p>
        <div className="flex w-fit items-center gap-2 rounded-xl bg-paper px-3 py-[7px] text-[12.5px]">
          <span aria-hidden className="size-[7px] rounded-full bg-warning" />
          <span className="font-semibold text-ink">INC-20517</span>
          <span className="text-ink-3">Rede e VPN · Alta · em até 4 h</span>
        </div>
      </div>
    </div>
  );
}

const STATS = [
  { value: "8 s", label: "primeira resposta, em média" },
  { value: "72%", label: "resolvidos sem fila" },
  { value: "6", label: "analistas online agora", live: true },
];

export function Showcase() {
  return (
    <section className="hidden flex-col justify-between overflow-hidden bg-ink px-12 pt-10 pb-12 text-white lg:flex xl:px-16">
      <div className="flex items-center gap-2.5">
        <NexoMark className="h-[21px] w-6 text-white" />
        <span className="text-[17px] font-bold tracking-[-0.2px]">Nexo Assist</span>
      </div>

      <div className="flex flex-col gap-9">
        <div className="flex flex-col gap-[18px]">
          <p className="text-[13.5px] font-medium text-white/55">Service desk de TI da Nexo</p>
          <h1 className="font-display text-[44px] leading-[1.04] tracking-[-1.2px] xl:text-[54px]">
            Seu problema de TI, resolvido em uma conversa.
          </h1>
          <p className="max-w-[520px] text-base leading-[1.55] text-white/65">
            Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central de ajuda e chama um
            analista quando precisa.
          </p>
        </div>
        <div className="xl:pl-24">
          <ConversationPreview />
        </div>
      </div>

      <dl className="grid grid-cols-3 border-t border-white/10 pt-6">
        {STATS.map((stat, index) => (
          <div key={stat.label} className={index > 0 ? "border-l border-white/10 pl-6" : undefined}>
            <dd className="flex items-center gap-2 font-display text-[34px] tracking-[-0.6px]">
              {stat.value}
              {stat.live && <span aria-hidden className="size-2 rounded-full bg-success" />}
            </dd>
            <dt className="mt-1.5 text-[13.5px] text-white/55">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
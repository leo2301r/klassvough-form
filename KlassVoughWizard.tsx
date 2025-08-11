'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';

// Cores: roxo KV
const PURPLE = '#6F2DBD';

// Logo principal: arquivo local por padrão (estável para deploy)
const DEFAULT_LOGO_URL = '/kv-logo-negative.png';
// Fallback (glifo redondo KV) se a principal falhar
const FALLBACK_GLYPH_URL = '/kv-glyph.png';

// ---- Logo component ----
function BrandLogo({ size = 'clamp(220px, 30vw, 420px)' }: { size?: number | string }) {
  const [fallback, setFallback] = useState(false);
  const runtimeSrc =
    (typeof window !== 'undefined' && (window as any).__KV_LOGO__) || DEFAULT_LOGO_URL;
  const glyphSrc =
    (typeof window !== 'undefined' && (window as any).__KV_FALLBACK__) || FALLBACK_GLYPH_URL;
  const [src, setSrc] = useState<string>(runtimeSrc);

  useEffect(() => {
    setSrc(runtimeSrc);
    setFallback(false);
  }, [runtimeSrc]);

  if (fallback) {
    return (
      <img
        src={glyphSrc}
        alt=""
        className="block mx-auto"
        style={{ width: size as any, height: 'auto', objectFit: 'contain' }}
      />
    );
  }

  return (
    <img
      src={src}
      alt="Klass Vough"
      className="block mx-auto"
      style={{ width: size as any, height: 'auto' }}
      onError={() => setFallback(true)}
    />
  );
}

// ---- Types ----
export type Lead = {
  name: string;
  phone: string;
  email: string;
  city: string;
  consent: boolean;
  createdAt: Date;
};
type Errors = Partial<Record<keyof Omit<Lead,'createdAt'>, string>>;

// ---- Helpers ----
export function formatPhoneBR(value: string): string {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

export function validateLead(input: Omit<Lead, 'createdAt'>): Errors {
  const errs: Errors = {};
  if (!input.name || input.name.trim().length < 2) errs.name = 'Informe seu nome completo.';
  const phoneDigits = (input.phone || '').replace(/\D/g, '');
  if (phoneDigits.length < 10) errs.phone = 'Informe um telefone válido.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email || '')) errs.email = 'E-mail inválido.';
  if (!input.city || input.city.trim().length < 2) errs.city = 'Informe sua cidade.';
  if (!input.consent) errs.consent = 'É necessário consentir com a política.';
  return errs;
}

function toCSV(leads: Lead[]): string {
  const header = 'nome;email;telefone;cidade;consentimento;criado_em\n';
  const rows = leads
    .map((l) => [l.name, l.email, l.phone, l.city, l.consent ? 'sim' : 'nao', l.createdAt.toISOString()].join(';'))
    .join('\n');
  return header + rows;
}

function toPlainText(leads: Lead[]): string {
  const sep = '\r\n';
  if (!leads.length) return 'Sem leads no momento.' + sep;
  const body = leads
    .map((l) => [
      `Nome: ${l.name}`,
      `Email: ${l.email}`,
      `Telefone: ${l.phone}`,
      `Cidade: ${l.city}`,
      `Consentimento: ${l.consent ? 'sim' : 'nao'}`,
      `Criado_em: ${l.createdAt.toISOString()}`,
    ].join(sep))
    .join(sep + '---' + sep);
  return body + sep;
}

// ---- Auto download TXT per submission ----
function pad2(n: number) { return n.toString().padStart(2, '0'); }
function formatLeadFileName(l: Lead): string {
  const d = new Date(l.createdAt);
  const yyyy = d.getUTCFullYear();
  const mm = pad2(d.getUTCMonth()+1);
  const dd = pad2(d.getUTCDate());
  const hh = pad2(d.getUTCHours());
  const mi = pad2(d.getUTCMinutes());
  const ss = pad2(d.getUTCSeconds());
  return `lead_${yyyy}${mm}${dd}_${hh}${mi}${ss}.txt`;
}
function autoDownloadTxt(filename: string, text: string) {
  try {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_self';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch {} }, 0);
    return true;
  } catch {
    try {
      const href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
      window.open(href, '_blank');
      return false;
    } catch { return false; }
  }
}
function downloadSingleLead(l: Lead) {
  const txt = toPlainText([l]);
  const fname = formatLeadFileName(l);
  autoDownloadTxt(fname, txt);
}

// ---- UI bits ----
const HINTS = {
  name: 'Coloque seu nome completo',
  phone: 'Com DDD — se for Whats, melhor ainda',
  email: 'Digite certinho pra não cair no limbo do erro de digitação',
  city: 'Cidade/UF — ex.: São Paulo/SP',
  consent: 'Último passo: sua autorização LGPD',
} as const;

type StepId = 'name' | 'phone' | 'email' | 'city' | 'consent';
type Step = { id: StepId; label: string; placeholder?: string };

const STEPS: Step[] = [
  { id: 'name', label: 'Qual o seu nome?', placeholder: 'Escreva sua resposta...' },
  { id: 'phone', label: 'Qual o seu telefone?', placeholder: '(11) 9 0000-0000' },
  { id: 'email', label: 'Qual o seu e-mail?', placeholder: 'voce@exemplo.com' },
  { id: 'city', label: 'De qual cidade você fala?', placeholder: 'São Paulo/SP' },
  { id: 'consent', label: 'Autoriza contato da KlassVough?', placeholder: '' },
];

function Progress({ stepIndex }: { stepIndex: number }) {
  const pct = Math.round(((stepIndex + 1) / STEPS.length) * 100);
  return (
    <div className="w-full h-1 rounded" style={{ backgroundColor: 'rgba(255,255,255,.25)' }}>
      <div className="h-1 rounded" style={{ width: `${pct}%`, backgroundColor: '#fff' }} />
    </div>
  );
}

function FadeIn({ children, deps }: { children: React.ReactNode; deps: any[] }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(false);
    const t = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return (
    <div style={{ opacity: show ? 1 : 0, transform: show ? 'translateY(0px)' : 'translateY(10px)',
      transition: 'opacity .35s ease, transform .35s ease' }}>
      {children}
    </div>
  );
}

function ArrowNav({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2">
      <button onClick={onPrev} className="w-8 h-8 rounded-full border text-white" style={{ borderColor: 'rgba(255,255,255,.35)' }}>↑</button>
      <button onClick={onNext} className="w-8 h-8 rounded-full border text-white" style={{ borderColor: 'rgba(255,255,255,.35)' }}>↓</button>
    </div>
  );
}

function Question({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-white">{label}</h2>
      {hint && <p className="text-sm text-white/80">{hint}</p>}
      {children}
    </div>
  );
}

function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="min-h-screen w-full flex items-center justify-center text-white" style={{ backgroundColor: PURPLE }}>
      <div className="max-w-3xl w-full px-6 text-center space-y-8">
        <div className="flex justify-center" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.15))' }}>
          <BrandLogo size="clamp(220px, 30vw, 420px)" />
        </div>
        <p className="text-white/80 text-lg">Compromisso com a beleza.</p>
        <button onClick={onStart} className="mt-2 inline-flex items-center justify-center rounded-md bg-white text-[#6F2DBD] hover:bg-white/90 px-6 py-3 font-medium">
          Começar →
        </button>
      </div>
    </section>
  );
}

function ThankYouOverlay() {
  return (
    <section className="min-h-screen w-full flex items-center justify-center text-white" style={{ backgroundColor: PURPLE }}>
      <div className="text-center space-y-4 px-6">
        <div className="mx-auto w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center text-2xl">✓</div>
        <h2 className="text-3xl font-bold">Obrigado!</h2>
        <p className="text-white/80">Recebemos seus dados. Voltando à tela inicial…</p>
      </div>
    </section>
  );
}

export default function KlassVoughLeadsWizard() {
  const [started, setStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [consent, setConsent] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [admin, setAdmin] = useState(false);
  const focusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { focusRef.current?.focus(); }, [started, stepIndex]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const u = new URLSearchParams(window.location.search);
        const v = u.get('admin');
        if (v && ['1','true','yes'].includes(v)) setAdmin(true);
      } catch {}
    }
  }, []);

  const maskedPhone = useMemo(() => formatPhoneBR(phone), [phone]);
  const currentStep = STEPS[stepIndex];
  const errors = useMemo(() => validateLead({ name, phone: maskedPhone, email, city, consent }),
    [name, maskedPhone, email, city, consent]);

  function canAdvance(id: StepId) {
    switch (id) {
      case 'name': return !errors.name;
      case 'phone': return !errors.phone;
      case 'email': return !errors.email;
      case 'city': return !errors.city;
      case 'consent': return !errors.consent;
    }
  }

  function next() {
    if (!canAdvance(currentStep.id)) return;
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      const newLead: Lead = { name, phone: maskedPhone, email, city, consent, createdAt: new Date() };
      // Download automático de TXT por lead
      downloadSingleLead(newLead);
      setLeads((prev) => [newLead, ...prev]);
      setSubmitted(true);
      setShowThankYou(true);
      // Reset
      setStepIndex(0); setName(''); setPhone(''); setEmail(''); setCity(''); setConsent(false);
      setTimeout(() => { setSubmitted(false); setShowThankYou(false); setStarted(false); }, 2000);
    }
  }
  function prev() { if (stepIndex > 0) setStepIndex(stepIndex - 1); }

  function downloadCSV() {
    const csv = toCSV(leads);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'leads_klassvough.csv'; a.click();
    URL.revokeObjectURL(url);
  }
  function downloadTXT() {
    const txt = toPlainText(leads);
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'leads_klassvough.txt'; a.click();
    URL.revokeObjectURL(url);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) { e.preventDefault(); setAdmin(a => !a); return; }
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); next(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); prev(); }
  }

  if (showThankYou) { return <ThankYouOverlay />; }
  if (!started) { return <Hero onStart={() => setStarted(true)} />; }

  return (
    <main className="min-h-screen text-white px-4 py-10" style={{ backgroundColor: PURPLE }}>
      <div className="mx-auto max-w-4xl space-y-8" ref={focusRef} tabIndex={0} onKeyDown={onKeyDown}>
        <header className="text-center space-y-2">
          <div className="flex justify-center" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.15))' }}>
            <BrandLogo size="clamp(90px, 12vw, 180px)" />
          </div>
          <p className="text-white/80">Compromisso com a beleza.</p>
        </header>

        {submitted && (
          <div className="rounded-xl border border-white/20 bg-white/10 text-white px-4 py-3">
            Obrigado! Recebemos seus dados com sucesso.
          </div>
        )}

        <div className="relative rounded-2xl shadow-sm overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,.2)', background: 'rgba(255,255,255,.06)', backdropFilter: 'blur(6px)' }}>
          <div className="p-6">
            <Progress stepIndex={stepIndex} />
          </div>
          <div className="px-6 pb-8">
            <FadeIn deps={[stepIndex]}>
              <Question label={currentStep.label} hint={HINTS[currentStep.id]}>
                {currentStep.id === 'name' && (
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={currentStep.placeholder}
                    className="w-full bg-transparent border-0 border-b-2 outline-none py-2 placeholder-white/60 text-white"
                    style={{ borderBottomColor: 'rgba(255,255,255,.6)' }}
                    onFocus={(e)=>{(e.currentTarget.style.borderBottomColor='#fff')}}
                    onBlur={(e)=>{(e.currentTarget.style.borderBottomColor='rgba(255,255,255,.6)')}}
                  />
                )}
                {currentStep.id === 'phone' && (
                  <input
                    value={maskedPhone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={currentStep.placeholder}
                    className="w-full bg-transparent border-0 border-b-2 outline-none py-2 placeholder-white/60 text-white"
                    style={{ borderBottomColor: 'rgba(255,255,255,.6)' }}
                    onFocus={(e)=>{(e.currentTarget.style.borderBottomColor='#fff')}}
                    onBlur={(e)=>{(e.currentTarget.style.borderBottomColor='rgba(255,255,255,.6)')}}
                  />
                )}
                {currentStep.id === 'email' && (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={currentStep.placeholder}
                    className="w-full bg-transparent border-0 border-b-2 outline-none py-2 placeholder-white/60 text-white"
                    style={{ borderBottomColor: 'rgba(255,255,255,.6)' }}
                    onFocus={(e)=>{(e.currentTarget.style.borderBottomColor='#fff')}}
                    onBlur={(e)=>{(e.currentTarget.style.borderBottomColor='rgba(255,255,255,.6)')}}
                  />
                )}
                {currentStep.id === 'city' && (
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder={currentStep.placeholder}
                    className="w-full bg-transparent border-0 border-b-2 outline-none py-2 placeholder-white/60 text-white"
                    style={{ borderBottomColor: 'rgba(255,255,255,.6)' }}
                    onFocus={(e)=>{(e.currentTarget.style.borderBottomColor='#fff')}}
                    onBlur={(e)=>{(e.currentTarget.style.borderBottomColor='rgba(255,255,255,.6)')}}
                  />
                )}
                {currentStep.id === 'consent' && (
                  <label className="flex items-start gap-3 text-sm select-none">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
                    <span className="text-white/90">
                      Autorizo o contato da KlassVough e concordo com a{' '}
                      <a href="#" className="underline">Política de Privacidade</a>.
                    </span>
                  </label>
                )}

                <p className="text-sm text-red-200 mt-2 h-5">
                  {currentStep.id === 'name' && (errors.name || '')}
                  {currentStep.id === 'phone' && (errors.phone || '')}
                  {currentStep.id === 'email' && (errors.email || '')}
                  {currentStep.id === 'city' && (errors.city || '')}
                  {currentStep.id === 'consent' && (errors.consent || '')}
                </p>

                <button
                  onClick={next}
                  className="mt-2 inline-flex items-center justify-center rounded-md bg-white text-[#6F2DBD] hover:bg-white/90 px-4 py-2 text-sm font-medium"
                >
                  {stepIndex < STEPS.length - 1 ? 'Responder' : 'Enviar'}
                </button>
              </Question>
            </FadeIn>
          </div>

          <ArrowNav onPrev={prev} onNext={next} />
        </div>

        {admin && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Leads recebidos (sessão atual)</h2>
            <div className="flex items-center gap-2">
              <button onClick={downloadCSV} disabled={leads.length === 0} className="rounded-xl bg-white text-[#6F2DBD] hover:bg-white/90 disabled:opacity-50 px-3 py-1.5 text-sm">Exportar CSV</button>
              <button onClick={downloadTXT} disabled={leads.length === 0} className="rounded-xl bg-white/80 text-[#6F2DBD] hover:bg-white/70 disabled:opacity-50 px-3 py-1.5 text-sm">Exportar TXT</button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border bg-white text-gray-900">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Data</th>
                  <th className="p-3 text-left">Nome</th>
                  <th className="p-3 text-left">E-mail</th>
                  <th className="p-3 text-left">Telefone</th>
                  <th className="p-3 text-left">Cidade</th>
                  <th className="p-3 text-left">Consentimento</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr><td className="p-3 text-gray-500" colSpan={6}>Nenhum lead ainda. Envie o formulário acima.</td></tr>
                ) : leads.map((l, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3">{new Date(l.createdAt).toLocaleString()}</td>
                    <td className="p-3">{l.name}</td>
                    <td className="p-3">{l.email}</td>
                    <td className="p-3">{l.phone}</td>
                    <td className="p-3">{l.city}</td>
                    <td className="p-3">{l.consent ? 'Sim' : 'Não'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        )}

        {admin && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Self-tests</h2>
          <ul className="space-y-1">
            {[
              { name: 'Máscara 11 dígitos (celular)', ok: formatPhoneBR('11987654321') === '(11) 98765-4321' },
              { name: 'Máscara 10 dígitos (fixo)', ok: formatPhoneBR('1123456789') === '(11) 2345-6789' },
              { name: 'Validação: e-mail inválido', ok: !!validateLead({ name: 'A', phone: '(11) 99999-0000', email: 'x@', city: 'SP', consent: true }).email },
              { name: 'Validação: consentimento obrigatório', ok: !!validateLead({ name: 'Ana', phone: '(11) 99999-0000', email: 'ana@ex.com', city: 'SP', consent: false }).consent },
              { name: 'Validação: OK', ok: Object.keys(validateLead({ name: 'Ana', phone: '(11) 99999-0000', email: 'ana@ex.com', city: 'SP', consent: true })).length === 0 },
            ].map((t, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm">
                <span className={t.ok ? 'text-green-300' : 'text-red-300'}>{t.ok ? '✔' : '✘'}</span>
                <span>{t.name}</span>
              </li>
            ))}
          </ul>
        </section>
        )}
      </div>
    </main>
  );
}

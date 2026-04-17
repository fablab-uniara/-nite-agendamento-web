import * as P from '@phosphor-icons/react';
import { useEffect, useState, useMemo } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
// import { ImportadorCSV } from '../components/ImportadorCSV';
import type { Agendamento, Parametros } from '../lib/firestore';
import {
  DEFAULT_PARAMETROS,
  buscarParametros, buscarTodosAgendamentos, buscarSeguranca,
  atualizarAgendamento, excluirAgendamento, criarAgendamento,
  verificarConflito, isoToBr, brToIso, applyDateMask, applyTimeMask, applyPhoneMask, todayIso,
} from '../lib/firestore';
// ─── Helpers ──────────────────────────────────────────────────────────────────

function exportCSV(items: Agendamento[]) {
  const header = ['Data', 'Início', 'Fim', 'Curso', 'Disciplina', 'Conteúdo', 'Espaço', 'Uso', 'Recursos', 'Responsável', 'Telefone', 'Qtd. Pessoas'];
  const rows = items.map((a) => {
    const [usoPuro, recursoExtra] = a.tipoUso.split(' (Recurso: ');
    const recursoFormatado = recursoExtra ? recursoExtra.replace(')', '') : 'Nenhum';
    
    return [
      isoToBr(a.data), a.horaInicio, a.horaFim, a.curso, a.disciplina || '', 
      a.conteudo || '', a.espaco, usoPuro, recursoFormatado, a.nomeResponsavel, 
      a.telefoneResponsavel, a.quantidadePessoas
    ];
  });
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nite-agendamentos-${todayIso()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Função Sênior para verificar a capacidade do espaço
const getCapacidadeMaxima = (espaco: string) => {
  if (!espaco) return null;
  const nome = espaco.toLowerCase().replace(/\s+/g, '');
  if (nome.includes('classlab1')) return 114;
  if (nome.includes('classlab2')) return 50;
  if (nome.includes('fablab')) return 40;
  return null; // Sem limite definido (ex: espaços da Saúde)
};

// ─── Field components ─────────────────────────────────────────────────────────

// Mudamos de "text-sm" para "text-base sm:text-sm" para evitar o zoom automático no iPhone
const inputCls = "w-full border border-slate-300 rounded-xl px-4 py-3 text-base sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-nite-blue/40 focus:border-nite-blue transition-all";
const selectCls = inputCls + " cursor-pointer";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-slate-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const isSaudeSpace = (nome: string) => {
  const n = nome.toLowerCase().replace(/\s+/g, '');
  const isNite = n.includes('nite');
  
  // Admin Saúde vê as salas da Saúde E as salas Tech. 
  // A única sala que ele NÃO pode ver no filtro é a exclusiva "NITE".
  return !isNite;
};

// ─── Modal base ───────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Edit / Copy form ─────────────────────────────────────────────────────────

interface AgForm {
  espaco: string; tipoUso: string; data: string; horaInicio: string; horaFim: string;
  curso: string; disciplina: string; conteudo: string; quantidadePessoas: string; nomeResponsavel: string; telefoneResponsavel: string; observacoes: string;
}

function AgendamentoForm({
  initial, params, onSave, onClose, excludeId, title, isSuperAdmin
}: {
  initial: AgForm; params: Parametros; onSave: (f: AgForm) => Promise<void>; onClose: () => void; excludeId?: string; title: string; isSuperAdmin: boolean;
}) {
  const [form, setForm] = useState<AgForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<Agendamento | null>(null);

  const update = (field: keyof AgForm) => (value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setError(''); setConflict(null);
    if (!form.nomeResponsavel.trim()) { setError('Informe o nome do responsável.'); return; }
    if (!form.espaco) { setError('Selecione o espaço.'); return; }
    if (!form.data || form.data.length < 10) { setError('Data inválida.'); return; }
    if (!form.horaInicio || !form.horaFim) { setError('Informe os horários.'); return; }
    if (form.horaFim <= form.horaInicio) { setError('Hora fim deve ser posterior à hora início.'); return; }

    // <-- INÍCIO DA NOVA TRAVA DE SEGURANÇA SÊNIOR -->
    const dataIso = brToIso(form.data);
    const dataMax = new Date();
    dataMax.setDate(dataMax.getDate() + 15);
    const limiteIso = new Date(dataMax.getTime() - (dataMax.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    
    if (!isSuperAdmin && dataIso > limiteIso) {
      setError('Você só pode agendar com no máximo 15 dias de antecedência.'); 
      return;
    }

    const qtd = Number(form.quantidadePessoas);
    if (!form.quantidadePessoas || qtd < 1) {
      setError('A quantidade mínima é de 1 pessoa.');
      return;
    }
    const maxCap = getCapacidadeMaxima(form.espaco);
    if (maxCap && qtd > maxCap) {
      setError(`A capacidade máxima é de ${maxCap} pessoas.`);
      return;
    }
    // <-- FIM DA NOVA TRAVA DE SEGURANÇA SÊNIOR -->

    setSaving(true);
    try {
      const isoDate = brToIso(form.data);
      const c = await verificarConflito(form.espaco, isoDate, form.horaInicio, form.horaFim, excludeId);
      if (c) { setConflict(c); setSaving(false); return; }
      await onSave({ ...form, data: isoDate });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome do Responsável" required>
            <input type="text" className={inputCls} value={form.nomeResponsavel} onChange={(e) => update('nomeResponsavel')(e.target.value)} />
          </Field>
          <Field label="Telefone">
            <input type="text" className={inputCls} value={form.telefoneResponsavel} onChange={(e) => update('telefoneResponsavel')(applyPhoneMask(e.target.value))} maxLength={15} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Espaço" required>
            <select className={selectCls} value={form.espaco} onChange={(e) => update('espaco')(e.target.value)}>
              <option value="">Selecione...</option>
              {params.espacos.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </Field>
          <Field label="Tipo de Uso" required>
            <select className={selectCls} value={form.tipoUso} onChange={(e) => update('tipoUso')(e.target.value)}>
              <option value="">Selecione...</option>
              {params.tiposUso.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Data (DD/MM/AAAA)" required>
              <div className="relative">
                <P.CalendarBlank size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="date" className={`${inputCls} pl-10`} value={brToIso(form.data)} max={isSuperAdmin ? undefined : applyDateMask(new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0])} onChange={(e) => update('data')(isoToBr(e.target.value))} placeholder="DD/MM/AAAA" />
              </div>
            </Field>
            <Field label="Início (HH:MM)" required>
              <div className="relative">
                <P.Clock size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" className={`${inputCls} pl-10`} value={form.horaInicio} onChange={(e) => update('horaInicio')(applyTimeMask(e.target.value))} placeholder="00:00" />
              </div>
            </Field>
            <Field label="Fim (HH:MM)" required>
              <div className="relative">
                <P.Clock size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" className={`${inputCls} pl-10`} value={form.horaFim} onChange={(e) => update('horaFim')(applyTimeMask(e.target.value))} placeholder="00:00" />
              </div>
            </Field>
          </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Curso" required>
            <select className={selectCls} value={form.curso} onChange={(e) => update('curso')(e.target.value)}>
              <option value="">Selecione...</option>
              {params.cursos.map((c) => (
                c === '— Pós-Graduação —'
                  ? <option key={c} value="" disabled>──── Pós-Graduação ────</option>
                  : <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          <Field label="Disciplina" required>
            <input type="text" className={inputCls} value={form.disciplina} onChange={(e) => update('disciplina')(e.target.value)} placeholder="Nome da disciplina" />
          </Field>
        </div>

        {/* Campo de Conteúdos Múltiplos no Modal (Selecione até 5) */}
          {['Medicina', 'Enfermagem', 'Fisioterapia'].includes(form.curso) && params.conteudos?.[form.curso] && params.conteudos[form.curso].length > 0 && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Conteúdos (Selecione de 1 a 5)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1 max-h-40 overflow-y-auto p-3 border border-slate-300 rounded-xl bg-slate-50 focus-within:border-nite-blue focus-within:ring-1 focus-within:ring-nite-blue transition-all">
                {params.conteudos[form.curso].map((cont: string) => {
                  const selecionados = form.conteudo ? form.conteudo.split(' • ') : [];
                  const isSelected = selecionados.includes(cont);

                  return (
                    <label key={cont} className="flex items-start gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        className="mt-0.5 flex-shrink-0 w-4 h-4 accent-blue-600 cursor-pointer"
                        checked={isSelected}
                        onChange={() => {
                          if (isSelected) {
                            // Desmarca o conteúdo
                            setForm({ ...form, conteudo: selecionados.filter(c => c !== cont).join(' • ') });
                          } else {
                            // Marca o conteúdo limitando a 5
                            if (selecionados.length >= 5) {
                              alert('Você pode selecionar no máximo 5 conteúdos.');
                            } else {
                              setForm({ ...form, conteudo: [...selecionados, cont].join(' • ') });
                            }
                          }
                        }}
                      />
                      <span className="text-sm text-slate-700 group-hover:text-blue-600 transition-colors leading-snug break-words">
                        {cont}
                      </span>
                    </label>
                  );
                })}
              </div>
              
              {/* Contador visual */}
              <div className="mt-1 text-xs font-medium text-slate-500">
                Selecionados: <span className={form.conteudo ? 'text-nite-blue font-bold' : ''}>
                  {form.conteudo ? form.conteudo.split(' • ').length : 0}/5
                </span>
              </div>
            </div>
          )}

        <Field label={`Quantidade de Pessoas ${getCapacidadeMaxima(form.espaco) ? `(Máx: ${getCapacidadeMaxima(form.espaco)})` : ''}`} required>
          <input type="number" className={inputCls} value={form.quantidadePessoas} onChange={(e) => update('quantidadePessoas')(e.target.value)} placeholder="Ex: 25" min={1} max={getCapacidadeMaxima(form.espaco) || ''} />
        </Field>
        <div className="md:col-span-2">
            <Field label="Observações (Opcional)">
              <textarea
                className={`${inputCls} min-h-[80px] resize-y`}
                value={form.observacoes || ''}
                onChange={(e) => update('observacoes')(e.target.value)}
                placeholder="Ex: Sala precisa de 10 cadeiras extras."
              />
            </Field>
          </div>

        {conflict && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-sm text-red-700">
            <P.WarningCircle size={18} className="inline-block mr-1.5" /> Conflito: <strong>{conflict.espaco}</strong> já reservado {conflict.horaInicio}–{conflict.horaFim} por <strong>{conflict.nomeResponsavel}</strong>.
          </div>
        )}
        {error && <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-nite-blue text-white font-bold py-3 rounded-xl hover:bg-blue-900 disabled:opacity-60 transition-colors">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Recorrente modal ─────────────────────────────────────────────────────────

function RecorrenteModal({ params, onClose, isSuperAdmin }: { params: Parametros; onClose: () => void; isSuperAdmin: boolean }) {
  const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const [form, setForm] = useState({
    espaco: '', tipoUso: '', horaInicio: '', horaFim: '', curso: '', disciplina: '', conteudo: '',
    quantidadePessoas: '', nomeResponsavel: '', telefoneResponsavel: '', observacoes: '',
    dataInicio: isoToBr(todayIso()), dataFim: '', diasSemana: [] as number[],
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const update = (field: string) => (value: string) => setForm((f) => ({ ...f, [field]: value }));

  const toggleDay = (d: number) =>
    setForm((f) => ({
      ...f,
      diasSemana: f.diasSemana.includes(d) ? f.diasSemana.filter((x) => x !== d) : [...f.diasSemana, d],
    }));

  const handleSave = async () => {
    setError(''); setResult('');
    if (!form.nomeResponsavel.trim() || !form.espaco || !form.horaInicio || !form.horaFim || !form.dataInicio || !form.dataFim) {
      setError('Preencha todos os campos obrigatórios.'); return;
    }
    if (form.diasSemana.length === 0) { setError('Selecione ao menos um dia da semana.'); return; }

    const endIso = brToIso(form.dataFim);
    const dataMax = new Date();
    dataMax.setDate(dataMax.getDate() + 15);
    const limiteIso = new Date(dataMax.getTime() - (dataMax.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    
    if (!isSuperAdmin && endIso > limiteIso) {
      setError('A Data Final ultrapassa o limite de 15 dias de antecedência.'); 
      return;
    }

    const qtd = Number(form.quantidadePessoas);
    if (!form.quantidadePessoas || qtd < 1) { setError('A quantidade mínima é de 1 pessoa.'); return; }
    const maxCap = getCapacidadeMaxima(form.espaco);
    if (maxCap && qtd > maxCap) { setError(`A capacidade máxima é de ${maxCap} pessoas.`); return; }

    setSaving(true);
    try {
      const start = new Date(brToIso(form.dataInicio) + 'T12:00:00');
      const end = new Date(brToIso(form.dataFim) + 'T12:00:00');
      let count = 0; let skipped = 0;
      const cur = new Date(start);
      while (cur <= end) {
        if (form.diasSemana.includes(cur.getDay())) {
          const isoDate = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
          const c = await verificarConflito(form.espaco, isoDate, form.horaInicio, form.horaFim);
          if (!c) {
            await criarAgendamento({
              espaco: form.espaco, tipoUso: form.tipoUso, data: isoDate,
              horaInicio: form.horaInicio, horaFim: form.horaFim, curso: form.curso, 
              disciplina: form.disciplina.trim(), conteudo: form.conteudo || '', quantidadePessoas: form.quantidadePessoas,
              nomeResponsavel: form.nomeResponsavel.trim(), telefoneResponsavel: form.telefoneResponsavel || '',
            });
            count++;
          } else { skipped++; }
        }
        cur.setDate(cur.getDate() + 1);
      }
      setResult(`<P.CheckCircle size={18} className="inline-block mr-1.5" /> ${count} agendamento(s) criado(s). ${skipped > 0 ? `${skipped} ignorado(s) por conflito.` : ''}`);
    } catch (error) {
      // Usamos 'error' aqui para coincidir com a definição acima
      setError(error instanceof Error ? error.message : 'Erro ao criar recorrências.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal 
      title={<span className="flex items-center gap-2"><P.ArrowsClockwise size={20} /> Agendamento Recorrente</span>} 
      onClose={onClose}>
      
      <div className="flex flex-col gap-5">
        {result && (
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-emerald-700 text-sm flex items-center gap-2 animate-in fade-in duration-300">
            <P.CheckCircle size={20} weight="fill" />
            {result}
          </div>
        )}
        {/* Bloco 1: Responsável e Telefone */}
        <div className="mb-2">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Responsável</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome do Responsável" required>
              <input type="text" className={inputCls} value={form.nomeResponsavel} onChange={(e) => update('nomeResponsavel')(e.target.value)} placeholder="Nome completo do professor"/>
            </Field>
            <Field label="Telefone">
              <input type="text" className={inputCls} value={form.telefoneResponsavel} onChange={(e) => update('telefoneResponsavel')(applyPhoneMask(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
            </Field>
          </div>
        </div>

        {/* Bloco 2: Grupo / Turma / Disciplina / Conteúdo */}
        <div className="mb-2">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 mt-4">Grupo / Turma</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Curso" required>
              <select className={selectCls} value={form.curso} onChange={(e) => update('curso')(e.target.value)}>
                <option value="">Selecione...</option>
                {params.cursos.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Disciplina" required>
              <input type="text" className={inputCls} value={form.disciplina} onChange={(e) => update('disciplina')(e.target.value)} placeholder="Nome da disciplina" />
            </Field>
          </div>
        </div>

        {/* Campo de Conteúdos (Condicional) */}
            {['Medicina', 'Enfermagem', 'Fisioterapia'].includes(form.curso) && (
              <Field label="Conteúdo / Tema da Aula (Opcional)">
                <select className={selectCls} value={form.conteudo} onChange={(e) => update('conteudo')(e.target.value)}>
                  <option value="">Selecione o conteúdo...</option>
                  {(params.conteudos?.[form.curso] || []).map((c: string, i: number) => (
                    <option key={i} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
            )}

        {/* Bloco 3: Espaço e Tipo de Uso */}
        <div className="mb-2">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 mt-4">Espaço e Tipo de Uso</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Espaço" required>
              <select className={selectCls} value={form.espaco} onChange={(e) => update('espaco')(e.target.value)} disabled={!form.curso}>
                <option value="">{form.curso ? "Selecione o espaço..." : "Selecione o curso primeiro"}</option>
                {params.espacos.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </Field>
            <Field label="Tipo de Uso">
              <select className={selectCls} value={form.tipoUso} onChange={(e) => update('tipoUso')(e.target.value)}>
                <option value="">Selecione...</option>
                {params.tiposUso.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* Bloco 4: Datas / Horários / Quantidade de Pessoas */}
        <div className="mb-2">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 mt-4">Datas e Horários</h2>
          
          {/* Horários e Qtd */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <Field label="Hora Início" required>
              <div className="relative">
                <P.Clock size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                <input type="time" className={`${inputCls} pl-10`} value={form.horaInicio} onChange={(e) => update('horaInicio')(e.target.value)} />
              </div>
            </Field>
            <Field label="Hora Fim" required>
              <div className="relative">
                <P.Clock size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                <input type="time" className={`${inputCls} pl-10`} value={form.horaFim} onChange={(e) => update('horaFim')(e.target.value)} />
              </div>
            </Field>
            <Field label="Qtd. Pessoas">
              <input type="number" className={inputCls} value={form.quantidadePessoas} onChange={(e) => update('quantidadePessoas')(e.target.value)} placeholder="Ex: 25" min={0} />
            </Field>
          </div>
          
          {/* Dias da Semana */}
          <div className="mb-4">
            <label className="text-sm font-semibold text-slate-700 block mb-2">Dias da Semana <span className="text-red-500">*</span></label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                    form.diasSemana.includes(i)
                      ? 'bg-nite-blue text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Período de Datas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Data Início" required>
              <div className="relative">
                <P.CalendarBlank size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                <input type="date" className={`${inputCls} pl-10`} value={brToIso(form.dataInicio)} onChange={(e) => update('dataInicio')(isoToBr(e.target.value))} />
              </div>
            </Field>
            <Field label="Data Fim" required>
              <div className="relative">
                <P.CalendarBlank size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                <input type="date" className={`${inputCls} pl-10`} value={brToIso(form.dataFim)} onChange={(e) => update('dataFim')(isoToBr(e.target.value))} />
              </div>
            </Field>
          </div>
        </div>

        {/* Bloco 5: Observações */}
        <div className="mb-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 mt-4">Observações (Para este lote)</h2>
          <Field label="">
            <textarea
              className={`${inputCls} min-h-[80px] resize-y`}
              value={form.observacoes}
              onChange={(e) => update('observacoes')(e.target.value)}
              placeholder="A mesma observação será aplicada a todas as datas."
            />
          </Field>
        </div>

        {error && <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition-colors">Fechar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-nite-blue text-white font-bold py-3 rounded-xl hover:bg-blue-900 disabled:opacity-60 transition-colors">
            {saving ? 'Criando...' : (
              <span className="flex items-center gap-2 justify-center">
                <P.ArrowsClockwise size={20} /> Criar Recorrências</span>)}
          </button>
        </div>
        </div>
    </Modal>
  );
}

// ─── Modal de Gerenciar Conteúdos ─────────────────────────────────────────────
function GerenciarConteudosModal({ params, onClose, reload }: { params: Parametros, onClose: () => void, reload: () => void }) {
  const [curso, setCurso] = useState('Medicina');
  // Cria uma cópia local dos conteúdos para podermos editar antes de salvar
  const [conteudos, setConteudos] = useState<Record<string, string[]>>({
    Medicina: [...(params.conteudos?.Medicina || [])],
    Enfermagem: [...(params.conteudos?.Enfermagem || [])],
    Fisioterapia: [...(params.conteudos?.Fisioterapia || [])]
  });
  const [novo, setNovo] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = () => {
    if (!novo.trim()) return;
    setConteudos(prev => ({
      ...prev,
      // Adiciona o novo e organiza a lista em ordem alfabética automaticamente
      [curso]: [...prev[curso], novo.trim()].sort((a, b) => a.localeCompare(b))
    }));
    setNovo('');
  };

  const handleRemove = (idx: number) => {
    setConteudos(prev => {
      const atualizado = [...prev[curso]];
      atualizado.splice(idx, 1);
      return { ...prev, [curso]: atualizado };
    });
  };

  const handleChange = (idx: number, val: string) => {
    setConteudos(prev => {
      const atualizado = [...prev[curso]];
      atualizado[idx] = val;
      return { ...prev, [curso]: atualizado };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Limpa possíveis campos vazios antes de enviar para o banco
      const limpos = {
        Medicina: conteudos.Medicina.filter(c => c.trim() !== ''),
        Enfermagem: conteudos.Enfermagem.filter(c => c.trim() !== ''),
        Fisioterapia: conteudos.Fisioterapia.filter(c => c.trim() !== ''),
      };
      await setDoc(doc(db, 'parametros', 'config'), { conteudos: limpos }, { merge: true });
      reload();
      onClose();
    } catch (err) {
      console.error("Erro ao salvar", err);
      alert('Erro ao salvar os conteúdos.');
    }
    setSaving(false);
  };

  const inputCls = "w-full bg-slate-100 border-none rounded-xl px-4 py-3 text-slate-700 font-medium focus:ring-2 focus:ring-nite-blue outline-none transition-all";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <P.ListDashes size={24} className="text-nite-blue" /> Gerenciar Conteúdos
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><P.X size={20} weight="bold" /></button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {/* Seletor de Curso */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">1. Selecione o Curso</label>
            <select className={inputCls} value={curso} onChange={(e) => setCurso(e.target.value)}>
              <option value="Medicina">Medicina</option>
              <option value="Enfermagem">Enfermagem</option>
              <option value="Fisioterapia">Fisioterapia</option>
            </select>
          </div>

          {/* Adicionar Novo */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="text-sm font-semibold text-slate-700 block mb-2">2. Adicionar Novo Conteúdo</label>
            <div className="flex gap-2">
              <input type="text" className={inputCls} value={novo} onChange={e => setNovo(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="Nome do novo tema/aula..." />
              <button onClick={handleAdd} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 rounded-xl font-bold transition-colors shadow-md">Adicionar</button>
            </div>
          </div>

          {/* Lista Editável */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">3. Conteúdos Salvos de {curso} ({conteudos[curso].length})</label>
            <div className="flex flex-col gap-2">
              {conteudos[curso].map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="text" className={`${inputCls} py-2 text-sm`} value={c} onChange={(e) => handleChange(i, e.target.value)} />
                  <button onClick={() => handleRemove(i)} className="p-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-colors" title="Remover"><P.Trash size={18} weight="bold" /></button>
                </div>
              ))}
              {conteudos[curso].length === 0 && <p className="text-slate-400 text-sm italic">Nenhum conteúdo cadastrado para este curso.</p>}
            </div>
          </div>
        </div>

        {/* Rodapé e Salvar */}
        <div className="p-6 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-nite-blue text-white font-bold py-3 rounded-xl hover:bg-blue-900 disabled:opacity-60 transition-colors shadow-md">
            {saving ? 'Salvando...' : 'Salvar no Banco de Dados'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Fora do componente ou no topo
  const CURSOS_SAUDE = ['Medicina', 'Farmácia', 'Enfermagem', 'Psicologia', 'Fisioterapia', 'Educação Física'];
// ─── Main component ───────────────────────────────────────────────────────────

export default function Gerenciador() {
  const [user] = useAuthState(auth);
  
  // Dentro do componente Gerenciador, junto com os outros states:
  const [isAdminSaude, setIsAdminSaude] = useState(false);

  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [params, setParams] = useState<Parametros>(DEFAULT_PARAMETROS);
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);
  const [filterDate, setFilterDate] = useState(isoToBr(todayIso()));
  const [filterEspaco, setFilterEspaco] = useState('');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const [adminRole, setAdminRole] = useState<'super' | 'saude' | 'comum'>('comum');

  const [editTarget, setEditTarget] = useState<Agendamento | null>(null);
  const [copyTarget, setCopyTarget] = useState<Agendamento | null>(null);
  const [showRecorrente, setShowRecorrente] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Agendamento | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [obsTarget, setObsTarget] = useState<Agendamento | null>(null);

  const [showConteudosModal, setShowConteudosModal] = useState(false);

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (user?.email) {
      buscarSeguranca().then(config => {
        const email = user.email!.toLowerCase();
        // Super Admin: está na lista 'admins'
        setIsSuperAdmin(config?.admins?.includes(email) || false);
        // Admin Saúde: está na lista 'adminsSaude' (certifique-se de ter esse campo no Firebase)
        setIsAdminSaude(config?.adminsSaude?.includes(email) || false);
      });
    }
  }, [user]);

  const handleImportarTxt = (evento: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    setImportando(true);
    const leitor = new FileReader();

    leitor.onload = async (e) => {
      const texto = e.target?.result as string;
      const linhas = texto.split(/\r?\n/);
      const mapaProfessores: Record<string, string> = {};

      // Deteta automaticamente se o arquivo usa vírgula (,) ou ponto-e-vírgula (;)
      const separador = linhas[0].includes(';') ? ';' : ',';

      // REGRA 1: O 'let i = 1' faz o código pular a Linha 0 (Títulos) e começar da Linha 1 (Dados)
      for (let i = 1; i < linhas.length; i++) {
        const linha = linhas[i].trim();
        if (!linha) continue;

        const colunas = linha.split(separador);
        
        // Verifica se a linha tem pelo menos 3 colunas (A, B e C)
        if (colunas.length >= 3) {
          // Função rápida para limpar as aspas invisíveis do Excel
          const limpa = (str: string) => str.replace(/^"|"$/g, '').trim();
          
          // REGRA 2: Mapeando as colunas A, B e C (0, 1 e 2)
          const firstName = limpa(colunas[0]); // Coluna A
          const lastName = limpa(colunas[1]);  // Coluna B
          const email = limpa(colunas[2]).toLowerCase(); // Coluna C

          // Se a coluna C tiver um '@', é um e-mail válido, então salva o professor
          if (email.includes('@')) {
            // Junta o Primeiro Nome e o Sobrenome
            mapaProfessores[email] = `${firstName} ${lastName}`.trim();
          }
        }
      }

      try {
        if (Object.keys(mapaProfessores).length === 0) {
          alert("Nenhum professor foi encontrado. Verifique se escolheu o arquivo correto.");
          setImportando(false);
          return;
        }

        await setDoc(doc(db, 'seguranca', 'acesso'), {
          emailsPermitidos: mapaProfessores
        }, { merge: true });
        
        alert(`Sucesso! ${Object.keys(mapaProfessores).length} professores importados com sucesso.`);
      } catch (erro) {
        console.error("Erro ao salvar:", erro);
        alert("Erro ao importar para o banco de dados.");
      } finally {
        setImportando(false);
        if (evento.target) evento.target.value = ''; // Reseta o botão para permitir novo clique
      }
    };

    leitor.readAsText(arquivo);
  };

  /* CÓDIGO OCULTADO TEMPORARIAMENTE: Para quando precisar importar CSV novamente
  const [importandoConteudos, setImportandoConteudos] = useState(false);

  const handleImportarConteudos = (evento: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    setImportandoConteudos(true);
    const leitor = new FileReader();

    leitor.onload = async (e) => {
      const texto = e.target?.result as string;
      const linhas = texto.split(/\r?\n/);
      
      const conteudos: Record<string, string[]> = {
        'Medicina': [], 'Enfermagem': [], 'Fisioterapia': []
      };

      const separador = linhas[0].includes(';') ? ';' : ',';

      // Começa do i=1 para pular o cabeçalho (Linha 0)
      for (let i = 1; i < linhas.length; i++) {
        const linha = linhas[i].trim();
        if (!linha) continue;

        const colunas = linha.split(separador);
        const limpa = (str?: string) => str ? str.replace(/^"|"$/g, '').trim() : '';

        // Coluna A (0) = Medicina, Coluna B (1) = Enfermagem, Coluna C (2) = Fisioterapia
        const med = limpa(colunas[0]);
        const enf = limpa(colunas[1]);
        const fisio = limpa(colunas[2]);

        if (med) conteudos['Medicina'].push(med);
        if (enf) conteudos['Enfermagem'].push(enf);
        if (fisio) conteudos['Fisioterapia'].push(fisio);
      }

      try {
        await setDoc(doc(db, 'parametros', 'config'), { conteudos }, { merge: true });
        alert(`Sucesso! Conteúdos importados:\nMedicina: ${conteudos['Medicina'].length}\nEnfermagem: ${conteudos['Enfermagem'].length}\nFisioterapia: ${conteudos['Fisioterapia'].length}`);
      } catch (erro) {
        console.error("Erro ao salvar:", erro);
        alert("Erro ao importar para o banco de dados.");
      } finally {
        setImportandoConteudos(false);
        if (evento.target) evento.target.value = '';
      }
    };
    leitor.readAsText(arquivo);
  };
  */

  // Limpa as opções dos dropdowns se o usuário for Admin da Saúde
  const filteredParams = useMemo(() => {
    return {
      ...params,
      espacos: adminRole === 'saude' 
        ? params.espacos.filter(isSaudeSpace) 
        : params.espacos
    };
  }, [params, adminRole]);

  const filtered = useMemo(() => {
    return agendamentos.filter((a) => {
      // 1. Regra de Visualização Sênior (RBAC)
      const emailLogado = user?.email?.toLowerCase();
      const ehDono = a.emailResponsavel === emailLogado;
      const ehCursoSaude = CURSOS_SAUDE.includes(a.curso);

      // Bloqueios de visão baseados no cargo
      if (!isSuperAdmin) {
        if (isAdminSaude) {
          // Admin Saúde vê os cursos dele OU os agendamentos que ele mesmo criou em outras áreas
          if (!ehCursoSaude && !ehDono) return false;
        } else {
          // Segurança extra: Se um professor comum tentar aceder, vê só o dele
          if (!ehDono) return false;
        }
      }

      // 2. Filtros de Pesquisa (Data, Espaço, Busca)
      if (filterDate && a.data !== brToIso(filterDate)) return false;
      if (filterEspaco && a.espaco !== filterEspaco) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!a.nomeResponsavel.toLowerCase().includes(q) && !a.espaco.toLowerCase().includes(q) && !a.curso.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [agendamentos, filterDate, filterEspaco, search, isSuperAdmin, isAdminSaude, user]);

  // Reload que faz a checagem de segurança primeiro
  const reload = async () => {
    setLoading(true);
    
    // 1. CHECAGEM DE CARGO SÊNIOR
    if (user?.email) {
      const config = await buscarSeguranca();
      const email = user.email.toLowerCase();
      
      if (config?.admins?.includes(email)) {
        setAdminRole('super');
      } else if (config?.adminsSaude?.includes(email)) {
        setAdminRole('saude');
      } else {
        setAdminRole('comum');
      }
    }

    // 2. BUSCA OS DADOS
    const [ags, p] = await Promise.all([buscarTodosAgendamentos(), buscarParametros()]);
    setAgendamentos(ags); 
    setParams(p); 
    setLoading(false);
  };

  // Aciona o reload toda vez que o usuário carregar a página
  useEffect(() => {
    if (user) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    await excluirAgendamento(deleteTarget.id);
    setAgendamentos((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="bg-nite-blue text-white px-6 py-5">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">
              <P.ShieldCheckered size={32} weight="fill" className="inline-block mr-2 text-white/60" /> 
              Painel Gerenciador
            </h1>
            <p className="text-white/60 text-sm">{agendamentos.length} agendamento(s) no total</p>
          </div>
          <div className="flex flex-wrap gap-2">
            
            <button
              onClick={() => navigate('/')}
              className="bg-white/10 hover:bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <P.House size={18} /> Início
            </button>

            <button
              onClick={() => navigate('/agendar')}
              className="bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-md"
            >
              <P.CalendarPlus size={18} /> Agendar Sala
            </button>

            {/* Só mostra o botão de importar se for SUPER Admin */}
            {adminRole === 'super' && (
              <label className={`bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center ${importando ? 'opacity-50' : ''}`}>
                {importando ? (
                  <span className="flex items-center gap-2">
                    <P.Hourglass size={20} className="animate-spin" /> Importando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <P.FileArrowUp size={20} /> Importar Professores
                  </span>
                )}
                <input type="file" accept=".txt,.csv" className="hidden" onChange={handleImportarTxt} disabled={importando} />
              </label>
            )}

            {/* Botão de Gerenciar Conteúdos (Super Admin) */}
            {adminRole === 'super' && (
              <button 
                onClick={() => setShowConteudosModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-md"
              >
                <P.ListDashes size={20} /> Gerenciar Conteúdos
              </button>
            )}

            {/* Botão Temporário de Importar Conteúdos CSV */}
            {/*
            {adminRole === 'super' && (
              <label className={`bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center shadow-md ${importandoConteudos ? 'opacity-50' : ''}`}>
                {importandoConteudos ? (
                  <span className="flex items-center gap-2"><P.Hourglass size={20} className="animate-spin" /> Importando...</span>
                ) : (
                  <span className="flex items-center gap-2"><P.ListDashes size={20} /> Importar Conteúdos</span>
                )}
                <input type="file" accept=".csv" className="hidden" onChange={handleImportarConteudos} disabled={importandoConteudos} />
              </label>
            )}
            */}
            
            <button
              onClick={() => setShowRecorrente(true)}
              className="bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <P.ArrowsClockwise size={20} className="mr-1.5 inline" /> Recorrente
            </button>
            <button
              onClick={() => exportCSV(filtered)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <P.FileCsv size={20} className="mr-1.5 inline" /> Exportar CSV
            </button>
            <button
              onClick={reload}
              className="bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <P.ArrowCounterClockwise size={20} className="mr-1.5 inline" /> Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* <div className="max-w-screen-xl mx-auto px-6 pt-6">
        {adminRole === 'super' && <ImportadorCSV />}
      </div>
      */}

      {/* Filters */}
      <div className="max-w-screen-xl mx-auto px-6 py-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nite-blue/40"
            placeholder="Buscar por nome, espaço ou curso..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            type="text"
            className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nite-blue/40 w-full sm:w-40"
            placeholder="Data DD/MM/AAAA"
            value={filterDate}
            onChange={(e) => setFilterDate(applyDateMask(e.target.value))}
            maxLength={10}
          />
          <select
            className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nite-blue/40 w-full sm:w-56 cursor-pointer"
            value={filterEspaco}
            onChange={(e) => setFilterEspaco(e.target.value)}
          >
            <option value="">Todos os espaços</option>
            {filteredParams.espacos.map((e) => (<option key={e} value={e}>{e}</option>))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-screen-xl mx-auto px-6 pb-10">
        {loading ? (
          <div className="text-center py-20 text-slate-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">Nenhum agendamento encontrado.</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Data/Horário', 'Curso', 'Disciplina', 'Conteúdo', 'Espaço', 'Uso', 'Recursos', 'Responsável', 'Qtd.', 'Ações'].map((h) => (
                      <th key={h} className="px-2 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ag, i) => {
                    const [usoPuro, recursoExtra] = ag.tipoUso.split(' (Recurso: ');
                    const recursoFormatado = recursoExtra ? recursoExtra.replace(')', '') : '—';

                    return (
                      <tr key={ag.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                        
                        {/* 1. Data e Horário Juntos */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="font-bold text-slate-700">{isoToBr(ag.data)}</div>
                          <div className="text-slate-500 text-xs tabular-nums mt-0.5">{ag.horaInicio}–{ag.horaFim}</div>
                        </td>
                        
                        {/* 2. Curso */}
                        <td className="px-2 py-3">
                          <div className="text-slate-600 text-xs leading-snug line-clamp-3 break-words min-w-[90px] max-w-[130px]">
                            {ag.curso}
                          </div>
                        </td>

                        {/* 3. Disciplina */}
                        <td className="px-2 py-3">
                          <div className="text-slate-600 text-xs leading-snug line-clamp-3 break-words min-w-[90px] max-w-[130px]">
                            {ag.disciplina || '—'}
                          </div>
                        </td>

                        {/* 4. Conteúdo */}
                        <td className="px-2 py-3">
                          <div className="text-slate-600 text-xs leading-snug line-clamp-3 break-words min-w-[100px] max-w-[160px]">
                            {ag.conteudo || '—'}
                          </div>
                        </td>

                        {/* 5. Espaço */}
                        <td className="px-2 py-3 text-slate-800 font-medium whitespace-normal min-w-[100px] leading-snug">
                          {ag.espaco}
                        </td>
                        
                        {/* 6. Uso */}
                        <td className="px-2 py-3 text-slate-600 whitespace-nowrap">{usoPuro}</td>

                        {/* 7. Recursos */}
                        <td className="px-2 py-3">
                          <div className="text-slate-600 text-xs leading-snug line-clamp-3 break-words min-w-[80px] max-w-[120px]">
                            {recursoFormatado}
                          </div>
                        </td>

                        {/* 8. Responsável (Quebra a linha no nome para caber) */}
                        <td className="px-2 py-3">
                          <div className="text-slate-800 font-medium text-sm leading-snug line-clamp-2 max-w-[140px]">{ag.nomeResponsavel}</div>
                          {ag.telefoneResponsavel && <div className="text-slate-400 text-xs mt-0.5">{ag.telefoneResponsavel}</div>}
                        </td>
                        
                        {/* 9. Qtd */}
                        <td className="px-2 py-3 text-slate-600 text-center">{ag.quantidadePessoas === '0' ? 'N/A' : ag.quantidadePessoas}</td>
                        
                        {/* 10. Ações (Compactadas apenas com Ícones para salvar muito espaço) */}
                        <td className="px-2 py-3">
                          <div className="flex gap-1.5">
                            <button onClick={() => setObsTarget(ag)} title="Observações" className="bg-amber-100 text-amber-700 hover:bg-amber-200 text-xs font-bold px-2 py-1.5 rounded-lg transition-colors">
                              <span className="flex items-center gap-1"><P.ChatText size={16} /> OBS</span>
                            </button>
                            
                            {/* BOTÃO EDITAR: Super Admin OU o dono do próprio agendamento */}
                            {(isSuperAdmin || ag.emailResponsavel === user?.email?.toLowerCase()) && (
                              <button onClick={() => setEditTarget(ag)} title="Editar" className="bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold px-2 py-1.5 rounded-lg transition-colors">
                                <P.PencilSimpleLine size={16} />
                              </button>
                            )}

                            {/* O Botão de Copiar fica liberado para todos (facilita o uso) */}
                            <button onClick={() => setCopyTarget(ag)} title="Copiar" className="bg-purple-100 text-purple-700 hover:bg-purple-200 font-bold px-2 py-1.5 rounded-lg transition-colors">
                              <P.Copy size={16} />
                            </button>

                            {/* BOTÃO EXCLUIR: Aparece para Super Admin OU para quem for o Dono do Agendamento */}
                            {(isSuperAdmin || ag.emailResponsavel === user?.email?.toLowerCase()) && (
                              <button onClick={() => setDeleteTarget(ag)} title="Excluir" className="bg-red-100 text-red-700 hover:bg-red-200 font-bold px-2 py-1.5 rounded-lg transition-colors">
                                <P.Trash size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
              Exibindo {filtered.length} de {agendamentos.length} agendamento(s)
            </div>
          </div>
        )}
      </div>
      
      {/* Obs modal */}
      {obsTarget && (
        <Modal title="Observações" onClose={() => setObsTarget(null)}>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 text-sm whitespace-pre-wrap min-h-[100px]">
            {obsTarget.observacoes || 'Nenhuma observação registrada.'}
          </div>
          <button onClick={() => setObsTarget(null)} className="mt-6 w-full bg-nite-blue text-white font-bold py-3 rounded-xl hover:bg-blue-900 transition-colors">
            Fechar
          </button>
        </Modal>
      )}

      {/* Edit modal */}
      {editTarget && (
        <AgendamentoForm
          title="Editar Agendamento"
          isSuperAdmin={isSuperAdmin}
          initial={{
            espaco: editTarget.espaco, tipoUso: editTarget.tipoUso,
            data: isoToBr(editTarget.data), horaInicio: editTarget.horaInicio, horaFim: editTarget.horaFim,
            curso: editTarget.curso,
            disciplina: editTarget.disciplina || '',
            conteudo: editTarget.conteudo || '',
            quantidadePessoas: editTarget.quantidadePessoas, nomeResponsavel: editTarget.nomeResponsavel,
            telefoneResponsavel: editTarget.telefoneResponsavel || '', observacoes: editTarget.observacoes || '',
          }}
          params={filteredParams}
          excludeId={editTarget.id}
          onClose={() => setEditTarget(null)}
          onSave={async (f) => {
            await atualizarAgendamento(editTarget.id!, { ...f });
            setAgendamentos((prev) => prev.map((a) => a.id === editTarget.id ? { ...a, ...f } : a));
            setEditTarget(null);
          }}
        />
      )}

      {/* Copy modal */}
      {copyTarget && (
        <AgendamentoForm
          title="Copiar Agendamento"
          isSuperAdmin={isSuperAdmin}
          initial={{
            espaco: copyTarget.espaco, tipoUso: copyTarget.tipoUso,
            data: isoToBr(todayIso()), horaInicio: copyTarget.horaInicio, horaFim: copyTarget.horaFim,
            curso: copyTarget.curso, disciplina: copyTarget.disciplina || '', conteudo: copyTarget.conteudo || '', quantidadePessoas: copyTarget.quantidadePessoas, nomeResponsavel: copyTarget.nomeResponsavel,
            telefoneResponsavel: copyTarget.telefoneResponsavel || '', observacoes: copyTarget.observacoes || '',
          }}
          params={filteredParams}
          onClose={() => setCopyTarget(null)}
          onSave={async (f) => {
            const id = await criarAgendamento({ ...f });
            setAgendamentos((prev) => [{ id, ...f }, ...prev]);
            setCopyTarget(null);
          }}
        />
      )}

      {/* Conteúdos modal */}
      {showConteudosModal && (
        <GerenciarConteudosModal 
          params={filteredParams} 
          onClose={() => setShowConteudosModal(false)} 
          reload={reload} 
        />
      )}

      {/* Recorrente modal */}
      {showRecorrente && ( <RecorrenteModal params={filteredParams} isSuperAdmin={isSuperAdmin} onClose={() => { setShowRecorrente(false); reload(); }}/>)}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="flex items-center gap-1.5"><P.Trash size={16} /> Excluir</div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Excluir agendamento?</h2>
            <p className="text-slate-500 text-sm mb-1"><strong>{deleteTarget.espaco}</strong></p>
            <p className="text-slate-500 text-sm mb-6">{isoToBr(deleteTarget.data)} • {deleteTarget.horaInicio}–{deleteTarget.horaFim}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-slate-300 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 disabled:opacity-60 transition-colors">
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

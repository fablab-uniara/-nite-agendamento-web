import { useEffect, useState } from 'react';
import type { Parametros, Agendamento } from '../lib/firestore';
import {
  DEFAULT_PARAMETROS,
  buscarParametros,
  criarAgendamento,
  verificarConflito,
  applyDateMask,
  applyTimeMask,
  applyPhoneMask,
  brToIso,
  isoToBr,
  todayIso,
} from '../lib/firestore';

interface FormData {
  espaco: string;
  tipoUso: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  curso: string;
  finalidade: string;
  quantidadePessoas: string;
  nomeResponsavel: string;
  telefoneResponsavel: string;
}

const EMPTY: FormData = {
  espaco: '', tipoUso: '', data: isoToBr(todayIso()),
  horaInicio: '', horaFim: '', curso: '', finalidade: '',
  quantidadePessoas: '', nomeResponsavel: '', telefoneResponsavel: '',
};

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

const inputCls = "w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-nite-blue/40 focus:border-nite-blue transition-all";
const selectCls = inputCls + " cursor-pointer";

export default function Agendar() {
  const [params, setParams] = useState<Parametros>(DEFAULT_PARAMETROS);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<Agendamento | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    buscarParametros().then(setParams);
  }, []);

  const update = (field: keyof FormData) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const validate = (): string | null => {
    if (!form.nomeResponsavel.trim()) return 'Informe o nome do responsável.';
    if (!form.espaco) return 'Selecione o espaço.';
    if (!form.tipoUso) return 'Selecione o tipo de uso.';
    if (!form.data || form.data.length < 10) return 'Informe a data no formato DD/MM/AAAA.';
    if (!form.horaInicio || form.horaInicio.length < 5) return 'Informe a hora de início.';
    if (!form.horaFim || form.horaFim.length < 5) return 'Informe a hora de fim.';
    if (form.horaFim <= form.horaInicio) return 'A hora de fim deve ser posterior à hora de início.';
    if (!form.curso) return 'Selecione o curso.';
    if (!form.finalidade) return 'Selecione a finalidade.';
    if (!form.quantidadePessoas) return 'Informe a quantidade de pessoas.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setConflict(null);
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    try {
      const isoDate = brToIso(form.data);
      const conflito = await verificarConflito(form.espaco, isoDate, form.horaInicio, form.horaFim);
      if (conflito) { setConflict(conflito); setSaving(false); return; }
      await criarAgendamento({
        espaco: form.espaco,
        tipoUso: form.tipoUso,
        data: isoDate,
        horaInicio: form.horaInicio,
        horaFim: form.horaFim,
        curso: form.curso,
        finalidade: form.finalidade,
        quantidadePessoas: form.quantidadePessoas,
        nomeResponsavel: form.nomeResponsavel.trim(),
        telefoneResponsavel: form.telefoneResponsavel || '',
      });
      setSuccess(true);
    } catch (ex: any) {
      setError('Erro ao salvar: ' + (ex?.message || 'tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Agendamento Confirmado!</h2>
          <p className="text-slate-500 mb-2">
            <strong>{form.espaco}</strong> reservado para <strong>{form.data}</strong>
          </p>
          <p className="text-slate-500 mb-6">
            Das <strong>{form.horaInicio}</strong> às <strong>{form.horaFim}</strong>
          </p>
          <p className="text-slate-400 text-sm mb-8">
            Responsável: {form.nomeResponsavel}
            {form.telefoneResponsavel && ` • ${form.telefoneResponsavel}`}
          </p>
          <button
            onClick={() => { setSuccess(false); setForm(EMPTY); }}
            className="w-full bg-nite-blue text-white font-bold py-3 rounded-xl hover:bg-blue-900 transition-colors"
          >
            Fazer outro agendamento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-nite-blue">Agendar Espaço</h1>
          <p className="text-slate-500 mt-1">Preencha os campos abaixo para reservar um espaço do NITE.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:p-8">
          {/* Responsável */}
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Responsável</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nome do Responsável" required>
                <input
                  type="text"
                  className={inputCls}
                  value={form.nomeResponsavel}
                  onChange={(e) => update('nomeResponsavel')(e.target.value)}
                  placeholder="Nome completo"
                />
              </Field>
              <Field label="Telefone / WhatsApp">
                <input
                  type="text"
                  className={inputCls}
                  value={form.telefoneResponsavel}
                  onChange={(e) => update('telefoneResponsavel')(applyPhoneMask(e.target.value))}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </Field>
            </div>
          </div>

          {/* Espaço e Tipo */}
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Espaço e Tipo de Uso</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Espaço" required>
                <select className={selectCls} value={form.espaco} onChange={(e) => update('espaco')(e.target.value)}>
                  <option value="">Selecione o espaço...</option>
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
          </div>

          {/* Data e Horário */}
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Data e Horário</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Data" required>
                <input
                  type="text"
                  className={inputCls}
                  value={form.data}
                  onChange={(e) => update('data')(applyDateMask(e.target.value))}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                />
              </Field>
              <Field label="Hora Início" required>
                <input
                  type="text"
                  className={inputCls}
                  value={form.horaInicio}
                  onChange={(e) => update('horaInicio')(applyTimeMask(e.target.value))}
                  placeholder="HH:MM"
                  maxLength={5}
                />
              </Field>
              <Field label="Hora Fim" required>
                <input
                  type="text"
                  className={inputCls}
                  value={form.horaFim}
                  onChange={(e) => update('horaFim')(applyTimeMask(e.target.value))}
                  placeholder="HH:MM"
                  maxLength={5}
                />
              </Field>
            </div>
          </div>

          {/* Grupo */}
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Grupo / Turma</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Field label="Curso" required>
                  <select className={selectCls} value={form.curso} onChange={(e) => update('curso')(e.target.value)}>
                    <option value="">Selecione o curso...</option>
                    {params.cursos.map((c) => (
                      c === '— Pós-Graduação —'
                        ? <option key={c} value="" disabled>──── Pós-Graduação ────</option>
                        : <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Quantidade de Pessoas" required>
                <input
                  type="number"
                  className={inputCls}
                  value={form.quantidadePessoas}
                  onChange={(e) => update('quantidadePessoas')(e.target.value)}
                  placeholder="Ex: 25"
                  min={1}
                  max={999}
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Finalidade" required>
                <select className={selectCls} value={form.finalidade} onChange={(e) => update('finalidade')(e.target.value)}>
                  <option value="">Selecione a finalidade...</option>
                  {params.finalidades.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* Conflict warning */}
          {conflict && (
            <div className="mb-4 bg-red-50 border border-red-300 rounded-xl p-4 text-sm text-red-700">
              <strong>⚠️ Conflito de horário!</strong> O espaço <strong>{conflict.espaco}</strong> já está
              reservado das <strong>{conflict.horaInicio}</strong> às <strong>{conflict.horaFim}</strong> por{' '}
              <strong>{conflict.nomeResponsavel}</strong>. Escolha outro horário ou espaço.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-300 rounded-xl p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-nite-blue text-white font-bold py-4 rounded-xl text-base hover:bg-blue-900 disabled:opacity-60 transition-colors shadow-md"
          >
            {saving ? 'Salvando...' : '✅ Confirmar Agendamento'}
          </button>
        </form>
      </div>
    </div>
  );
}

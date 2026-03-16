import { useEffect, useState, useMemo } from 'react';
import type { Agendamento, Parametros } from '../lib/firestore';
import {
  DEFAULT_PARAMETROS,
  buscarParametros, buscarTodosAgendamentos,
  atualizarAgendamento, excluirAgendamento, criarAgendamento,
  verificarConflito, isoToBr, brToIso, applyDateMask, applyTimeMask, applyPhoneMask, todayIso,
} from '../lib/firestore';

const PIN = '1217';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function exportCSV(items: Agendamento[]) {
  const header = ['Data', 'Início', 'Fim', 'Espaço', 'Tipo', 'Curso', 'Finalidade', 'Qtd. Pessoas', 'Responsável', 'Telefone'];
  const rows = items.map((a) => [
    isoToBr(a.data), a.horaInicio, a.horaFim, a.espaco, a.tipoUso,
    a.curso, a.finalidade, a.quantidadePessoas, a.nomeResponsavel, a.telefoneResponsavel || '',
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nite-agendamentos-${todayIso()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Field components ─────────────────────────────────────────────────────────

const inputCls = "w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-nite-blue/40 focus:border-nite-blue transition-all";
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

// ─── Modal base ───────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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
  curso: string; finalidade: string; quantidadePessoas: string; nomeResponsavel: string; telefoneResponsavel: string;
}

function AgendamentoForm({
  initial, params, onSave, onClose, excludeId, title,
}: {
  initial: AgForm; params: Parametros; onSave: (f: AgForm) => Promise<void>; onClose: () => void; excludeId?: string; title: string;
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
    setSaving(true);
    try {
      const isoDate = brToIso(form.data);
      const c = await verificarConflito(form.espaco, isoDate, form.horaInicio, form.horaFim, excludeId);
      if (c) { setConflict(c); setSaving(false); return; }
      await onSave({ ...form, data: isoDate });
    } catch (ex: any) {
      setError(ex?.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
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
        <div className="grid grid-cols-3 gap-4">
          <Field label="Data" required>
            <input type="text" className={inputCls} value={form.data} onChange={(e) => update('data')(applyDateMask(e.target.value))} placeholder="DD/MM/AAAA" maxLength={10} />
          </Field>
          <Field label="Hora Início" required>
            <input type="text" className={inputCls} value={form.horaInicio} onChange={(e) => update('horaInicio')(applyTimeMask(e.target.value))} placeholder="HH:MM" maxLength={5} />
          </Field>
          <Field label="Hora Fim" required>
            <input type="text" className={inputCls} value={form.horaFim} onChange={(e) => update('horaFim')(applyTimeMask(e.target.value))} placeholder="HH:MM" maxLength={5} />
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
          <Field label="Finalidade" required>
            <select className={selectCls} value={form.finalidade} onChange={(e) => update('finalidade')(e.target.value)}>
              <option value="">Selecione...</option>
              {params.finalidades.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Quantidade de Pessoas" required>
          <input type="number" className={inputCls} value={form.quantidadePessoas} onChange={(e) => update('quantidadePessoas')(e.target.value)} placeholder="Ex: 25" min={1} />
        </Field>

        {conflict && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-sm text-red-700">
            ⚠️ Conflito: <strong>{conflict.espaco}</strong> já reservado {conflict.horaInicio}–{conflict.horaFim} por <strong>{conflict.nomeResponsavel}</strong>.
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

function RecorrenteModal({ params, onClose }: { params: Parametros; onClose: () => void }) {
  const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const [form, setForm] = useState({
    espaco: '', tipoUso: '', horaInicio: '', horaFim: '', curso: '', finalidade: '',
    quantidadePessoas: '', nomeResponsavel: '', telefoneResponsavel: '',
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
              finalidade: form.finalidade, quantidadePessoas: form.quantidadePessoas,
              nomeResponsavel: form.nomeResponsavel.trim(), telefoneResponsavel: form.telefoneResponsavel || '',
            });
            count++;
          } else { skipped++; }
        }
        cur.setDate(cur.getDate() + 1);
      }
      setResult(`✅ ${count} agendamento(s) criado(s). ${skipped > 0 ? `${skipped} ignorado(s) por conflito.` : ''}`);
    } catch (ex: any) {
      setError(ex?.message || 'Erro ao criar recorrências.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="🔁 Agendamento Recorrente" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {result && <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-sm text-emerald-700">{result}</div>}

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
          <Field label="Tipo de Uso">
            <select className={selectCls} value={form.tipoUso} onChange={(e) => update('tipoUso')(e.target.value)}>
              <option value="">Selecione...</option>
              {params.tiposUso.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Hora Início" required>
            <input type="text" className={inputCls} value={form.horaInicio} onChange={(e) => update('horaInicio')(applyTimeMask(e.target.value))} placeholder="HH:MM" maxLength={5} />
          </Field>
          <Field label="Hora Fim" required>
            <input type="text" className={inputCls} value={form.horaFim} onChange={(e) => update('horaFim')(applyTimeMask(e.target.value))} placeholder="HH:MM" maxLength={5} />
          </Field>
          <Field label="Qtd. Pessoas">
            <input type="number" className={inputCls} value={form.quantidadePessoas} onChange={(e) => update('quantidadePessoas')(e.target.value)} placeholder="Ex: 25" min={1} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Curso">
            <select className={selectCls} value={form.curso} onChange={(e) => update('curso')(e.target.value)}>
              <option value="">Selecione...</option>
              {params.cursos.map((c) => (
                c === '— Pós-Graduação —'
                  ? <option key={c} value="" disabled>──── Pós-Graduação ────</option>
                  : <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Finalidade">
            <select className={selectCls} value={form.finalidade} onChange={(e) => update('finalidade')(e.target.value)}>
              <option value="">Selecione...</option>
              {params.finalidades.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
        </div>

        {/* Days of week */}
        <div>
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

        <div className="grid grid-cols-2 gap-4">
          <Field label="Data Início" required>
            <input type="text" className={inputCls} value={form.dataInicio} onChange={(e) => update('dataInicio')(applyDateMask(e.target.value))} placeholder="DD/MM/AAAA" maxLength={10} />
          </Field>
          <Field label="Data Fim" required>
            <input type="text" className={inputCls} value={form.dataFim} onChange={(e) => update('dataFim')(applyDateMask(e.target.value))} placeholder="DD/MM/AAAA" maxLength={10} />
          </Field>
        </div>

        {error && <div className="bg-red-50 border border-red-300 rounded-xl p-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition-colors">Fechar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-nite-blue text-white font-bold py-3 rounded-xl hover:bg-blue-900 disabled:opacity-60 transition-colors">
            {saving ? 'Criando...' : '🔁 Criar Recorrências'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Gerenciador() {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [params, setParams] = useState<Parametros>(DEFAULT_PARAMETROS);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [filterEspaco, setFilterEspaco] = useState('');
  const [search, setSearch] = useState('');

  const [editTarget, setEditTarget] = useState<Agendamento | null>(null);
  const [copyTarget, setCopyTarget] = useState<Agendamento | null>(null);
  const [showRecorrente, setShowRecorrente] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Agendamento | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handlePin = () => {
    if (pin === PIN) { setAuthenticated(true); setPinError(''); }
    else { setPinError('PIN incorreto. Tente novamente.'); setPin(''); }
  };

  useEffect(() => {
    if (!authenticated) return;
    Promise.all([buscarTodosAgendamentos(), buscarParametros()]).then(([ags, p]) => {
      setAgendamentos(ags); setParams(p); setLoading(false);
    });
  }, [authenticated]);

  const filtered = useMemo(() => {
    return agendamentos.filter((a) => {
      if (filterDate && a.data !== brToIso(filterDate)) return false;
      if (filterEspaco && a.espaco !== filterEspaco) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!a.nomeResponsavel.toLowerCase().includes(q) && !a.espaco.toLowerCase().includes(q) && !a.curso.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [agendamentos, filterDate, filterEspaco, search]);

  const reload = () => {
    setLoading(true);
    buscarTodosAgendamentos().then((ags) => { setAgendamentos(ags); setLoading(false); });
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    await excluirAgendamento(deleteTarget.id);
    setAgendamentos((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  };

  // ── PIN screen ──
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🛡️</div>
          <h1 className="text-2xl font-black text-slate-800 mb-1">Painel Gerenciador</h1>
          <p className="text-slate-500 text-sm mb-8">Digite o PIN de acesso para continuar.</p>
          <input
            type="password"
            className="w-full border border-slate-300 rounded-xl px-4 py-4 text-center text-2xl font-bold tracking-widest text-slate-800 focus:outline-none focus:ring-2 focus:ring-nite-blue/40 focus:border-nite-blue mb-3"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePin()}
            maxLength={6}
            placeholder="••••"
            autoFocus
          />
          {pinError && <p className="text-red-500 text-sm mb-3">{pinError}</p>}
          <button
            onClick={handlePin}
            className="w-full bg-nite-blue text-white font-bold py-3 rounded-xl hover:bg-blue-900 transition-colors"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-nite-blue text-white px-6 py-5">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">🛡️ Painel Gerenciador</h1>
            <p className="text-white/60 text-sm">{agendamentos.length} agendamento(s) no total</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowRecorrente(true)}
              className="bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              🔁 Recorrente
            </button>
            <button
              onClick={() => exportCSV(filtered)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              📥 Exportar CSV
            </button>
            <button
              onClick={reload}
              className="bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              🔄 Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-screen-xl mx-auto px-6 py-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nite-blue/40"
            placeholder="🔍 Buscar por nome, espaço ou curso..."
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
            {params.espacos.map((e) => <option key={e} value={e}>{e}</option>)}
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
                    {['Data', 'Horário', 'Espaço', 'Tipo', 'Curso', 'Responsável', 'Qtd.', 'Ações'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ag, i) => (
                    <tr key={ag.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                      <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">{isoToBr(ag.data)}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap tabular-nums">{ag.horaInicio}–{ag.horaFim}</td>
                      <td className="px-4 py-3 text-slate-800 font-medium max-w-[160px] truncate">{ag.espaco}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{ag.tipoUso}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[140px] truncate">{ag.curso}</td>
                      <td className="px-4 py-3">
                        <div className="text-slate-800 font-medium">{ag.nomeResponsavel}</div>
                        {ag.telefoneResponsavel && <div className="text-slate-400 text-xs">{ag.telefoneResponsavel}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-center">{ag.quantidadePessoas}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditTarget(ag)}
                            className="bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => setCopyTarget(ag)}
                            className="bg-amber-100 text-amber-700 hover:bg-amber-200 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            📋 Copiar
                          </button>
                          <button
                            onClick={() => setDeleteTarget(ag)}
                            className="bg-red-100 text-red-700 hover:bg-red-200 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
              Exibindo {filtered.length} de {agendamentos.length} agendamento(s)
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editTarget && (
        <AgendamentoForm
          title="✏️ Editar Agendamento"
          initial={{
            espaco: editTarget.espaco, tipoUso: editTarget.tipoUso,
            data: isoToBr(editTarget.data), horaInicio: editTarget.horaInicio, horaFim: editTarget.horaFim,
            curso: editTarget.curso, finalidade: editTarget.finalidade,
            quantidadePessoas: editTarget.quantidadePessoas, nomeResponsavel: editTarget.nomeResponsavel,
            telefoneResponsavel: editTarget.telefoneResponsavel || '',
          }}
          params={params}
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
          title="📋 Copiar Agendamento"
          initial={{
            espaco: copyTarget.espaco, tipoUso: copyTarget.tipoUso,
            data: isoToBr(todayIso()), horaInicio: copyTarget.horaInicio, horaFim: copyTarget.horaFim,
            curso: copyTarget.curso, finalidade: copyTarget.finalidade,
            quantidadePessoas: copyTarget.quantidadePessoas, nomeResponsavel: copyTarget.nomeResponsavel,
            telefoneResponsavel: copyTarget.telefoneResponsavel || '',
          }}
          params={params}
          onClose={() => setCopyTarget(null)}
          onSave={async (f) => {
            const id = await criarAgendamento({ ...f });
            setAgendamentos((prev) => [{ id, ...f }, ...prev]);
            setCopyTarget(null);
          }}
        />
      )}

      {/* Recorrente modal */}
      {showRecorrente && <RecorrenteModal params={params} onClose={() => { setShowRecorrente(false); reload(); }} />}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="text-4xl mb-4">🗑️</div>
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

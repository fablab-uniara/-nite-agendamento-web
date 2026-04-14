import * as P from '@phosphor-icons/react';
import { useEffect, useState, useMemo } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import type { Agendamento, Parametros } from '../lib/firestore';
import {
  DEFAULT_PARAMETROS,
  buscarParametros,
  buscarAgendamentosPorEmail,
  excluirAgendamento,
  isoToBr,
  brToIso,
  applyDateMask,
} from '../lib/firestore';

export default function MeusAgendamentos() {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();

  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [params, setParams] = useState<Parametros>(DEFAULT_PARAMETROS);
  const [loading, setLoading] = useState(true);
  
  const [filterDate, setFilterDate] = useState('');
  const [filterEspaco, setFilterEspaco] = useState('');
  const [filterCurso, setFilterCurso] = useState('');
  
  const [deleteTarget, setDeleteTarget] = useState<Agendamento | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [obsTarget, setObsTarget] = useState<Agendamento | null>(null);

  useEffect(() => {
    // Se o usuário não tiver email, não busca nada.
    if (!user?.email) return;

    Promise.all([
      buscarAgendamentosPorEmail(user.email),
      buscarParametros()
    ]).then(([ags, p]) => {
      setAgendamentos(ags); 
      setParams(p); 
      setLoading(false);
    });
  }, [user]);

  const cursosUnicos = useMemo(() => {
    const cursos = agendamentos.map(a => a.curso);
    return Array.from(new Set(cursos)).sort();
  }, [agendamentos]);

  const filtered = useMemo(() => {
    return agendamentos.filter((a) => {
      if (filterCurso && a.curso !== filterCurso) return false;
      if (filterDate && a.data !== brToIso(filterDate)) return false;
      if (filterEspaco && a.espaco !== filterEspaco) return false;
      
      return true;
    });
  }, [agendamentos, filterCurso, filterDate, filterEspaco]);

  const reload = () => {
    if (!user?.email) return;
    setLoading(true);
    buscarAgendamentosPorEmail(user.email).then((ags) => { 
      setAgendamentos(ags);
      setLoading(false); 
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await excluirAgendamento(deleteTarget.id);
      setAgendamentos((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    } catch (error) {
      console.error(error); // <-- Linha adicionada para utilizar a variável
      alert("Erro ao excluir agendamento.");
    } finally {
      setDeleteTarget(null);
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="bg-nite-blue text-white px-6 py-5">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">
              <P.BookmarkSimple size={32} weight="fill" className="inline-block mr-2 text-white/60" /> 
              Meus Agendamentos
            </h1>
            <p className="text-white/60 text-sm">{agendamentos.length} agendamento(s) realizado(s) por você</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate('/agendar')}
              className="bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-md"
            >
              <P.CalendarPlus size={18} /> Novo Agendamento
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

      {/* Filters */}
      <div className="max-w-screen-xl mx-auto px-6 py-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3">
        {/*  Filtro de Curso */}
          <select
            value={filterCurso}
            onChange={(e) => setFilterCurso(e.target.value)}
            className="border border-slate-300 text-slate-700 bg-white rounded-xl px-4 py-2.5 outline-none focus:border-nite-blue focus:ring-1 focus:ring-nite-blue transition-all"
          >
            <option value="">Todos os Cursos</option>
            {cursosUnicos.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {/*  Filtro de Datas */}
          <input
            type="text"
            className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nite-blue/40"
            placeholder="Filtrar por data DD/MM/AAAA"
            value={filterDate}
            onChange={(e) => setFilterDate(applyDateMask(e.target.value))}
            maxLength={10}
          />
          {/*  Filtro de Espaços */}
          <select
            className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nite-blue/40 cursor-pointer"
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
          <div className="text-center py-20 text-slate-400 flex flex-col items-center">
            <P.Spinner size={32} className="animate-spin mb-2" />
            Carregando seus agendamentos...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            Você ainda não possui nenhum agendamento ou nada foi encontrado no filtro.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Data', 'Horário', 'Espaço', 'Tipo', 'Curso', 'Disciplina', 'Pessoas', 'Ações'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ag, i) => (
                    <tr key={ag.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                      <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">{isoToBr(ag.data)}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap tabular-nums">{ag.horaInicio}–{ag.horaFim}</td>
                      <td className="px-4 py-3 text-slate-800 font-medium">{ag.espaco}</td>
                      <td className="px-4 py-3 text-slate-600">{ag.tipoUso}</td>
                      <td className="px-4 py-3 text-slate-600">{ag.curso}</td>
                      <td className="px-4 py-3 text-slate-600">{ag.disciplina}</td>
                      <td className="px-4 py-3 text-slate-600">{ag.quantidadePessoas}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setObsTarget(ag)}
                            className="bg-amber-100 text-amber-700 hover:bg-amber-200 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <P.ChatText size={16} /> Obs
                          </button>
                          <button
                            onClick={() => setDeleteTarget(ag)}
                            className="bg-red-100 text-red-700 hover:bg-red-200 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                            <P.Trash size={16} /> Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
              Exibindo {filtered.length} agendamento(s)
            </div>
          </div>
        )}
      </div>

      {/* Obs modal */}
      {obsTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><P.ChatText size={24} className="text-nite-blue"/> Observações</h2>
              <button onClick={() => setObsTarget(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 text-sm whitespace-pre-wrap min-h-[100px]">
              {obsTarget.observacoes || 'Nenhuma observação registrada para este agendamento.'}
            </div>
            <button onClick={() => setObsTarget(null)} className="mt-6 w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-900 transition-colors">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="flex items-center justify-center text-red-600 mb-4">
              <P.Trash size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Cancelar agendamento?</h2>
            <p className="text-slate-500 text-sm mb-1"><strong>{deleteTarget.espaco}</strong></p>
            <p className="text-slate-500 text-sm mb-6">{isoToBr(deleteTarget.data)} • {deleteTarget.horaInicio}–{deleteTarget.horaFim}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-slate-300 text-slate-600 font-semibold py-3 rounded-xl hover:bg-slate-50 transition-colors">Voltar</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 disabled:opacity-60 transition-colors">
                {deleting ? 'Cancelando...' : 'Sim, cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
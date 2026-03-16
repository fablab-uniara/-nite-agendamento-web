import { useEffect, useState, useCallback } from 'react';
import type { Agendamento } from '../lib/firestore';
import { onAgendamentosHoje, isoToBr, todayIso } from '../lib/firestore';

type Status = 'happening' | 'upcoming' | 'done';

function getStatus(ag: Agendamento, now: Date): Status {
  const [h, m] = ag.horaInicio.split(':').map(Number);
  const [eh, em] = ag.horaFim.split(':').map(Number);
  const start = h * 60 + m;
  const end = eh * 60 + em;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (cur >= start && cur < end) return 'happening';
  if (cur < start) return 'upcoming';
  return 'done';
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <div className="text-right">
      <div className="text-4xl font-black text-white tabular-nums tracking-tight">{time}</div>
      <div className="text-white/60 text-sm capitalize">{date}</div>
    </div>
  );
}

function AgCard({ ag, now }: { ag: Agendamento; now: Date }) {
  const status = getStatus(ag, now);
  const isHappening = status === 'happening';
  const isDone = status === 'done';

  return (
    <div
      className={`rounded-2xl p-5 border-2 transition-all flex flex-col gap-3 ${
        isHappening
          ? 'bg-emerald-950 border-emerald-400 pulse-green'
          : isDone
          ? 'bg-slate-800 border-slate-700 opacity-50'
          : 'bg-slate-800 border-slate-600'
      }`}
    >
      {/* Status badge */}
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-bold px-3 py-1 rounded-full ${
            isHappening
              ? 'bg-emerald-400 text-emerald-950'
              : isDone
              ? 'bg-slate-600 text-slate-300'
              : 'bg-blue-500/30 text-blue-300'
          }`}
        >
          {isHappening ? '🔴 ACONTECENDO AGORA' : isDone ? '✓ Finalizado' : '⏳ Em breve'}
        </span>
        <span className={`text-sm font-bold tabular-nums ${isHappening ? 'text-emerald-300' : 'text-slate-400'}`}>
          {ag.horaInicio} – {ag.horaFim}
        </span>
      </div>

      {/* Space name */}
      <h3 className={`text-lg font-black leading-tight ${isHappening ? 'text-white' : isDone ? 'text-slate-400' : 'text-white'}`}>
        {ag.espaco}
      </h3>

      {/* Details */}
      <div className="flex flex-wrap gap-2">
        <span className="bg-white/10 text-white/80 text-xs px-2 py-1 rounded-lg">{ag.tipoUso}</span>
        <span className="bg-white/10 text-white/80 text-xs px-2 py-1 rounded-lg">{ag.finalidade}</span>
        <span className="bg-white/10 text-white/80 text-xs px-2 py-1 rounded-lg">👥 {ag.quantidadePessoas}</span>
      </div>

      {/* Curso */}
      <p className="text-white/60 text-xs truncate">{ag.curso}</p>

      {/* Responsável */}
      <div className="border-t border-white/10 pt-3 mt-auto">
        <p className={`text-sm font-semibold ${isHappening ? 'text-emerald-300' : 'text-slate-300'}`}>
          👤 {ag.nomeResponsavel}
          {ag.telefoneResponsavel && <span className="text-white/50 font-normal"> • {ag.telefoneResponsavel}</span>}
        </p>
      </div>
    </div>
  );
}

export default function Painel() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const unsub = onAgendamentosHoje((items) => {
      setAgendamentos(items);
      setLoading(false);
      setError('');
    });
    return unsub;
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const happening = agendamentos.filter((a) => getStatus(a, now) === 'happening');
  const upcoming = agendamentos.filter((a) => getStatus(a, now) === 'upcoming');
  const done = agendamentos.filter((a) => getStatus(a, now) === 'done');

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-nite-blue px-6 py-4 flex items-center justify-between shadow-xl flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 rounded-xl px-4 py-2">
            <span className="font-black text-xl tracking-widest">NITE</span>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Painel de Agendamentos</h1>
            <p className="text-white/60 text-xs">{isoToBr(todayIso())}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Counters */}
          <div className="hidden md:flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-black text-emerald-400">{happening.length}</div>
              <div className="text-white/50 text-xs">Agora</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-blue-300">{upcoming.length}</div>
              <div className="text-white/50 text-xs">Em breve</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-slate-400">{done.length}</div>
              <div className="text-white/50 text-xs">Finalizados</div>
            </div>
          </div>

          <Clock />

          <button
            onClick={toggleFullscreen}
            className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            {isFullscreen ? '⊡ Sair' : '⛶ Tela Cheia'}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-6 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-white/50 text-lg">Carregando agendamentos...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-xl p-4 text-red-300 text-center mb-6">
            {error}
            <button onClick={() => window.location.reload()} className="ml-4 underline">Tentar novamente</button>
          </div>
        )}

        {!loading && agendamentos.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="text-6xl opacity-30">📅</div>
            <p className="text-white/40 text-xl font-semibold">Nenhum agendamento para hoje</p>
            <p className="text-white/25 text-sm">Os agendamentos aparecerão aqui em tempo real</p>
          </div>
        )}

        {!loading && agendamentos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {agendamentos.map((ag) => (
              <AgCard key={ag.id} ag={ag} now={now} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 px-6 py-2 flex items-center justify-between flex-shrink-0">
        <span className="text-white/30 text-xs">🔴 Atualização em tempo real via Firebase</span>
        <span className="text-white/30 text-xs">NITE — Sistema de Agendamento de Espaços</span>
      </footer>
    </div>
  );
}

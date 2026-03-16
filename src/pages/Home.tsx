import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import logo from '../assets/logo.png';

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <div className="text-center">
      <div className="text-5xl font-black text-white tabular-nums tracking-tight">{time}</div>
      <div className="text-white/60 text-sm mt-1 capitalize">{date}</div>
    </div>
  );
}

const CARDS = [
  {
    to: '/agendar',
    title: 'Agendar Espaço',
    description: 'Reserve salas, laboratórios e auditórios de forma rápida, com mínimo de digitação.',
    cta: 'Fazer reserva →',
    bg: 'bg-nite-blue',
    ctaColor: 'text-blue-300',
    icon: '📅',
  },
  {
    to: '/painel',
    title: 'Painel da Recepção',
    description: 'Visualize todos os agendamentos do dia em tempo real. Otimizado para TV 1920×1080.',
    cta: 'Abrir painel →',
    bg: 'bg-emerald-700',
    ctaColor: 'text-emerald-300',
    icon: '📺',
  },
  {
    to: '/gerenciador',
    title: 'Painel Gerenciador',
    description: 'Edite, copie, exclua agendamentos e crie recorrências. Acesso protegido por PIN.',
    cta: 'Acessar →',
    bg: 'bg-orange-700',
    ctaColor: 'text-orange-300',
    icon: '🛡️',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-nite-blue text-white py-16 px-6">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-10">
          <div className="flex flex-col items-center lg:items-start gap-4">
            <img src={logo} alt="NITE" className="w-24 h-24 rounded-2xl shadow-xl" />
            <div>
              <h1 className="text-4xl lg:text-5xl font-black tracking-widest text-center lg:text-left">NITE</h1>
              <p className="text-white/70 text-lg mt-1 text-center lg:text-left">Sistema de Agendamento de Espaços</p>
            </div>
          </div>
          <div className="flex-1 flex justify-center lg:justify-end">
            <div className="bg-white/10 rounded-2xl p-8 border border-white/20 backdrop-blur-sm">
              <Clock />
            </div>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-slate-800 mb-8 text-center">O que você deseja fazer?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CARDS.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="group bg-white rounded-2xl border border-slate-200 p-8 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 flex flex-col"
            >
              <div className={`w-14 h-14 ${card.bg} rounded-xl flex items-center justify-center text-2xl mb-5 shadow-md`}>
                {card.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">{card.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed flex-1">{card.description}</p>
              <div className={`mt-6 font-semibold text-sm ${card.ctaColor} group-hover:underline`}>
                {card.cta}
              </div>
            </Link>
          ))}
        </div>

        {/* Info banner */}
        <div className="mt-10 bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start gap-3">
          <span className="text-xl">🔥</span>
          <p className="text-blue-700 text-sm leading-relaxed">
            Agendamentos sincronizados em <strong>tempo real</strong> via Firebase Firestore.
            Qualquer reserva feita aparece instantaneamente no Painel da Recepção.
          </p>
        </div>
      </div>
    </div>
  );
}

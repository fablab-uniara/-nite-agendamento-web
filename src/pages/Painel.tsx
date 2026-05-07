import * as P from '@phosphor-icons/react';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Agendamento } from '../lib/firestore';
import { onAgendamentosHoje } from '../lib/firestore';
import logo from '../assets/logo.png';
import uniaraLogo from '../assets/uniara-logo.svg';

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
    <div className="text-center flex flex-col items-center justify-center">
      <div className="text-4xl sm:text-5xl font-black text-white tabular-nums tracking-tight drop-shadow-lg leading-none">{time}</div>
      <div className="text-white/80 text-xs sm:text-sm capitalize font-medium mt-1 tracking-wide">{date}</div>
    </div>
  );
}

function AgCard({ ag, variant, scale = 'normal' }: { ag: Agendamento; variant: 'large' | 'small'; scale?: 'normal' | 'medium' | 'small' | 'tiny' }) {
  if (variant === 'large') {
    // Configurações dinâmicas de tamanho baseadas na escala
    let titleSize = "text-3xl sm:text-4xl";
    let subtitleSize = "text-xl sm:text-2xl";
    let badgeSize = "text-sm px-4 py-2";
    let timeSize = "text-2xl px-4 py-1.5";
    let gapClass = "gap-2 mb-5";
    let paddingClass = "p-5 sm:p-6";
    let iconSize = 24;
    let respSize = "text-lg";

    if (scale === 'medium') {
      titleSize = "text-2xl sm:text-3xl"; subtitleSize = "text-lg sm:text-xl";
      badgeSize = "text-xs px-3 py-1.5"; timeSize = "text-xl px-3 py-1";
      gapClass = "gap-2 mb-3"; paddingClass = "p-4 sm:p-5"; iconSize = 20; respSize = "text-base";
    } else if (scale === 'small') {
      titleSize = "text-xl sm:text-2xl"; subtitleSize = "text-sm sm:text-base";
      badgeSize = "text-[10px] px-2 py-1"; timeSize = "text-lg px-2 py-1";
      gapClass = "gap-1.5 mb-2"; paddingClass = "p-3 sm:p-4"; iconSize = 18; respSize = "text-sm";
    } else if (scale === 'tiny') {
      titleSize = "text-lg sm:text-xl"; subtitleSize = "text-xs sm:text-sm";
      badgeSize = "text-[9px] px-2 py-1"; timeSize = "text-base px-2 py-1";
      gapClass = "gap-1 mb-2"; paddingClass = "p-2 sm:p-3"; iconSize = 16; respSize = "text-xs";
    }

    // LAYOUT: ACONTECENDO AGORA (Responsivo ao Grid)
    return (
      <div className={`relative bg-slate-800 rounded-3xl shadow-2xl ${paddingClass} overflow-hidden flex flex-col border-2 border-emerald-500/60 shadow-emerald-500/20 h-full`}>
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col flex-1 h-full">
          <div className={`flex justify-between items-start ${gapClass} flex-wrap`}>
            <span className={`bg-emerald-500 text-slate-900 rounded-xl font-black tracking-widest animate-pulse shadow-lg shadow-emerald-500/40 ${badgeSize}`}>ACONTECENDO AGORA</span>
            <div className={`font-black text-slate-100 tracking-tight bg-slate-900/60 rounded-xl border border-white/10 flex items-center gap-1.5 ${timeSize}`}>
              <P.Clock size={iconSize} className="text-emerald-400" /> {ag.horaInicio} – {ag.horaFim}
            </div>
          </div>
          
          <div className={`${gapClass} flex-grow overflow-hidden flex flex-col justify-center`}>
            <h2 className={`${titleSize} font-black text-white leading-tight mb-1 drop-shadow-md line-clamp-2`}>{ag.curso}</h2>
            <p className={`${subtitleSize} text-emerald-300 font-bold drop-shadow-sm line-clamp-2`}>{ag.disciplina}</p>
          </div>
          
          <div className={`flex flex-wrap ${gapClass}`}>
            <span className={`bg-white text-slate-900 rounded-xl font-bold flex items-center gap-1.5 shadow-md ${badgeSize}`}>
              <P.MapPin size={iconSize - 2} weight="fill" className="text-slate-700" /> {ag.espaco}
            </span>
            {ag.tipoUso && (
              <span className={`bg-slate-700 text-slate-100 rounded-xl font-bold flex items-center gap-1.5 border border-slate-600 shadow-md ${badgeSize}`}>
                <P.Tag size={iconSize - 2} weight="fill" className="text-slate-300" /> {ag.tipoUso}
              </span>
            )}
          </div>
          
          <div className={`mt-auto pt-2 border-t border-slate-700/60 flex items-center gap-2 text-slate-300`}>
            <P.User size={iconSize} weight="bold" className="text-emerald-400" />
            <span className={`text-xs sm:text-sm truncate`}>Resp: <strong className={`text-white font-bold ${respSize}`}>{ag.nomeResponsavel}</strong></span>
          </div>
        </div>
      </div>
    );
  }

  // LAYOUT: EM BREVE (Menor, Compacto, flexível para caber vários)
  return (
    <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-lg p-3 sm:p-4 overflow-hidden flex flex-col border border-slate-600/80 transition-all hover:bg-slate-800">
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex justify-between items-center mb-2 sm:mb-3 gap-2">
          <span className="bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider border border-blue-500/30">EM BREVE</span>
          <div className="font-bold text-slate-200 text-sm tracking-tight bg-slate-900/60 px-2 py-1 rounded-md border border-white/5 flex items-center gap-1.5">
            <P.Clock size={14} className="text-blue-400" /> {ag.horaInicio} – {ag.horaFim}
          </div>
        </div>
        <div className="mb-3 flex-grow">
          <h2 className="text-lg font-black text-white leading-tight mb-0.5 line-clamp-1">{ag.curso}</h2>
          <p className="text-sm text-blue-300 font-semibold line-clamp-1">{ag.disciplina}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="bg-slate-700 text-slate-200 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
            <P.MapPin size={12} weight="fill" className="text-slate-400" /> {ag.espaco}
          </span>
          {ag.tipoUso && (
            <span className="bg-slate-700/50 text-slate-300 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 border border-slate-600/50">
              <P.Tag size={12} weight="fill" className="text-slate-400" /> {ag.tipoUso}
            </span>
          )}
        </div>
        <div className="mt-auto pt-2 border-t border-slate-700/50 flex items-center gap-1.5 text-slate-400 text-xs">
          <P.User size={14} weight="bold" />
          <span className="truncate">Resp: <strong className="text-slate-200 font-semibold">{ag.nomeResponsavel}</strong></span>
        </div>
      </div>
    </div>
  );
}

export default function Painel() {
  const navigate = useNavigate();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // --- INÍCIO DA LÓGICA DO CARROSSEL ---
  const [bgIndex, setBgIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  // Array com o caminho das imagens que estão na pasta public/slides
  const slideImages = [
    '/slides/slide1.jpg',
    '/slides/slide2.jpg',
    '/slides/slide3.jpg',
    '/slides/slide4.jpg',
    '/slides/slide5.jpg',
    '/slides/slide6.jpg',
    '/slides/slide7.jpg'
  ];

  useEffect(() => {
    // Muda a imagem a cada 1 minuto (60000 milissegundos)
    const interval = setInterval(() => {
      setIsFading(true); // Inicia o efeito de fade-out (desaparecer)
      
      setTimeout(() => {
        setBgIndex((prev) => (prev + 1) % slideImages.length); // Passa para a próxima imagem
        setIsFading(false); // Inicia o efeito de fade-in (aparecer)
      }, 1000); // 1 segundo de ecrã escuro para uma transição suave
      
    }, 60000);

    return () => clearInterval(interval);
  }, [slideImages.length]);
  // --- FIM DA LÓGICA DO CARROSSEL ---
  
  // --- INÍCIO DA LÓGICA DE PAGINAÇÃO DO "ACONTECENDO AGORA" ---
  const HAPPENING_ITEMS_PER_PAGE = 10;
  const [happeningPage, setHappeningPage] = useState(0);
  const [isHappeningFading, setIsHappeningFading] = useState(false);

  // --- INÍCIO DA LÓGICA DE PAGINAÇÃO DO "EM BREVE" ---
  const [upcomingPage, setUpcomingPage] = useState(0);
  const [isUpcomingFading, setIsUpcomingFading] = useState(false);
  const ITEMS_PER_PAGE = 3; // Quantos cards cabem na coluna sem precisar rolar
  
  // Filtramos Apenas o que importa (Sem "Finalizados")
  const happening = agendamentos.filter((a) => getStatus(a, now) === 'happening');
  const upcoming = agendamentos.filter((a) => getStatus(a, now) === 'upcoming');

  const sortByTime = (a: Agendamento, b: Agendamento) => {
    const startA = parseInt(a.horaInicio.split(':')[0]) * 60 + parseInt(a.horaInicio.split(':')[1]);
    const startB = parseInt(b.horaInicio.split(':')[0]) * 60 + parseInt(b.horaInicio.split(':')[1]);
    return startA - startB;
  };

  const happeningSorted = [...happening].sort(sortByTime);
  const upcomingSorted = [...upcoming].sort(sortByTime);

  useEffect(() => {
    if (happeningSorted.length <= HAPPENING_ITEMS_PER_PAGE) return;

    const interval = setInterval(() => {
      setIsHappeningFading(true);
      setTimeout(() => {
        setHappeningPage((prev) => (prev + 1) % Math.ceil(happeningSorted.length / HAPPENING_ITEMS_PER_PAGE));
        setIsHappeningFading(false);
      }, 500);
    }, 30000); // 30 segundos
    return () => clearInterval(interval);
  }, [happeningSorted.length]);

  const maxHappeningPages = Math.ceil(happeningSorted.length / HAPPENING_ITEMS_PER_PAGE);
  const safeHappeningPage = (happeningSorted.length <= HAPPENING_ITEMS_PER_PAGE || happeningPage >= maxHappeningPages) ? 0 : happeningPage;
  
  const visibleHappening = happeningSorted.slice(
    safeHappeningPage * HAPPENING_ITEMS_PER_PAGE,
    (safeHappeningPage + 1) * HAPPENING_ITEMS_PER_PAGE
  );

  const countHappening = visibleHappening.length;
  let gridClass = "grid grid-cols-1 xl:grid-cols-2 gap-6 w-full h-full";
  let cardScale: 'normal' | 'medium' | 'small' | 'tiny' = 'normal';

  // Lógica Matemática do Grid: Quantos cabem?
  if (countHappening === 1) {
    gridClass = "flex-1 flex items-center justify-center w-full h-full";
    cardScale = 'normal';
  } else if (countHappening <= 4) {
    gridClass = "grid grid-cols-2 grid-rows-2 gap-4 w-full h-full pb-2";
    cardScale = 'normal';
  } else if (countHappening <= 6) {
    gridClass = "grid grid-cols-3 grid-rows-2 gap-4 w-full h-full pb-2";
    cardScale = 'medium';
  } else if (countHappening <= 8) {
    gridClass = "grid grid-cols-4 grid-rows-2 gap-3 w-full h-full pb-2";
    cardScale = 'small';
  } else if (countHappening <= 10) {
    gridClass = "grid grid-cols-5 grid-rows-2 gap-2 w-full h-full pb-2";
    cardScale = 'tiny';
  }

  useEffect(() => {
    // Se tiver 4 ou menos itens, não precisa paginar, apenas sai do efeito
    if (upcomingSorted.length <= ITEMS_PER_PAGE) {
      return;
    }

    const interval = setInterval(() => {
      setIsUpcomingFading(true); // Inicia o fade out
      
      setTimeout(() => {
        setUpcomingPage((prev) => (prev + 1) % Math.ceil(upcomingSorted.length / ITEMS_PER_PAGE));
        setIsUpcomingFading(false); // Inicia o fade in
      }, 500); // Meio segundo de tela preta na transição
      
    }, 30000); // Troca de página a cada 30 segundos

    return () => clearInterval(interval);
  }, [upcomingSorted.length]);

  // Calculamos uma "Página Segura": se a lista encolheu e a página atual não existe mais,
  // ou se temos 4 itens ou menos, ele força matematicamente a página 0.
  const maxPages = Math.ceil(upcomingSorted.length / ITEMS_PER_PAGE);
  const safePage = (upcomingSorted.length <= ITEMS_PER_PAGE || upcomingPage >= maxPages) ? 0 : upcomingPage;

  // Fatiamos o array usando a página segura
  const visibleUpcoming = upcomingSorted.slice(
    safePage * ITEMS_PER_PAGE,
    (safePage + 1) * ITEMS_PER_PAGE
  );
  // --- FIM DA LÓGICA DE PAGINAÇÃO ---

  useEffect(() => {
    const isTvAuthorized = sessionStorage.getItem('tv_auth') === 'true';
    if (!isTvAuthorized) {
      navigate('/restrito'); 
    }
  }, [navigate]);
  
  useEffect(() => {
    const unsub = onAgendamentosHoje((items) => {
      setAgendamentos(items);
      setLoading(false);
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

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col overflow-hidden">

      {/* Cabeçalho */}
      <header className="relative z-20 bg-nite-blue px-6 py-3 flex items-center justify-between shadow-xl flex-shrink-0 border-b border-blue-900/50">
        {/* Esquerda: Logos */}
        <div className="flex items-center gap-4 w-1/3">
          <img src={logo} alt="Logo NITE" className="w-10 h-10 rounded-lg object-cover" />
          <div className="flex items-center gap-4 ml-2">
            <h1 className="font-bold text-lg leading-tight hidden sm:block">Painel de Agendamentos</h1>
            <img src={uniaraLogo} alt="Logo Uniara" className="h-10 w-auto ml-2 hidden lg:block" />
          </div>
        </div>

        {/* Centro: Relógio */}
        <div className="flex justify-center w-1/3">
          <Clock />
        </div>

        {/* Direita: Índices/Contadores */}
        <div className="flex justify-end items-center w-1/3">
          <div className="flex items-center gap-4 bg-slate-900/40 px-5 py-2 rounded-2xl border border-white/10 shadow-inner">
            <div className="text-center">
              <div className="text-2xl font-black text-emerald-400 leading-none">{happening.length}</div>
              <div className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-1">Agora</div>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="text-center">
              <div className="text-2xl font-black text-blue-300 leading-none">{upcoming.length}</div>
              <div className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-1">Em breve</div>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal (Dividido em 2 Colunas) */}
      <main className="relative z-10 flex-1 p-6 overflow-hidden flex flex-col lg:flex-row gap-8">
        <div className="absolute inset-0 z-0 opacity-[0.03] bg-center bg-no-repeat bg-[length:100%] pointer-events-none" style={{ backgroundImage: `url('/logos-fundo.svg')` }}></div>
        
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="text-white/50 text-xl font-bold flex items-center gap-3"><P.Spinner size={32} className="animate-spin"/> Carregando painel...</div>
          </div>
        )}

        {/* Coluna Esquerda: ACONTECENDO AGORA */}
        <div className="flex-1 relative z-10 flex flex-col overflow-hidden pr-4">
          {happeningSorted.length > 0 ? (
            <div className={`flex-1 flex transition-opacity duration-500 ease-in-out ${isHappeningFading ? 'opacity-0' : 'opacity-100'}`}>
              
              {/* Indicador de Páginas (Aparece apenas se a fila passar de 10) */}
              {happeningSorted.length > HAPPENING_ITEMS_PER_PAGE && (
                <div className="absolute top-2 right-2 z-20 text-emerald-400/50 text-[10px] font-bold bg-emerald-900/40 px-2 py-1 rounded-md border border-emerald-500/20 shadow-lg">
                  Página {happeningPage + 1} / {Math.ceil(happeningSorted.length / HAPPENING_ITEMS_PER_PAGE)}
                </div>
              )}

              {/* Renderização Dinâmica */}
              {countHappening === 1 ? (
                <div className={gridClass}>
                  <div className="w-full max-w-4xl h-[70%]">
                    <AgCard key={visibleHappening[0].id} ag={visibleHappening[0]} variant="large" scale={cardScale} />
                  </div>
                </div>
              ) : (
                <div className={gridClass}>
                  {visibleHappening.map((ag) => (
                    <AgCard key={ag.id} ag={ag} variant="large" scale={cardScale} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            !loading && slideImages.length > 0 && (
              <div className="flex-1 relative rounded-3xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-900 transition-all">
                
                {/* A Imagem de Fundo com Animação Fade */}
                <div
                  className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${isFading ? 'opacity-0' : 'opacity-100'}`}
                  style={{ backgroundImage: `url(${slideImages[bgIndex]})` }}
                >
                  {/* Máscara escura opcional para a imagem não ficar demasiado brilhante na TV */}
                  <div className="absolute inset-0 bg-slate-900/20"></div>
                </div>

                {/* Pequeno selo discreto no canto inferior para informar o estado */}
                <div className="absolute bottom-6 right-6 bg-slate-900/70 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-lg">
                  <P.Coffee size={20} className="text-emerald-400" />
                  <span className="text-white/80 text-sm font-semibold tracking-wide">Nenhuma sala em uso no momento</span>
                </div>
                
              </div>
            )
          )}
        </div>

        {/* Coluna Direita: PRÓXIMOS EVENTOS */}
        <div className="w-full lg:w-[380px] relative z-10 flex flex-col bg-slate-900/50 border border-white/5 rounded-3xl p-5 shadow-2xl flex-shrink-0">
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
             <div className="flex items-center gap-2">
               <P.ListDashes size={20} className="text-blue-400" />
               <h2 className="text-blue-400 font-bold tracking-widest text-sm uppercase">Próximos Eventos</h2>
             </div>
             
             {/* Indicador de Páginas (Só aparece se tiver mais de 1 página) */}
             {upcomingSorted.length > ITEMS_PER_PAGE && (
               <span className="text-blue-400/50 text-[10px] font-bold bg-blue-900/20 px-2 py-1 rounded-md border border-blue-500/20">
                 {upcomingPage + 1} / {Math.ceil(upcomingSorted.length / ITEMS_PER_PAGE)}
               </span>
             )}
          </div>
          
          {/* Removemos o overflow-y-auto para remover a barra de rolagem */}
          <div className="flex-1 relative overflow-hidden">
            <div className={`space-y-3 transition-opacity duration-500 ease-in-out ${isUpcomingFading ? 'opacity-0' : 'opacity-100'}`}>
              {visibleUpcoming.length > 0 ? (
                visibleUpcoming.map((ag) => (
                  <AgCard key={ag.id} ag={ag} variant="small" />
                ))
              ) : (
                !loading && (
                  <div className="text-center mt-10">
                    <P.CalendarBlank size={48} className="text-white/10 mx-auto mb-3" />
                    <p className="text-white/30 text-sm font-semibold">Nenhum agendamento futuro para hoje.</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

      </main>

      {/* Rodapé (Com botões de ação) */}
      <footer className="relative z-20 bg-slate-800 px-6 py-3 flex items-center justify-between border-t border-slate-700/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <P.TelevisionSimple size={24} className="text-white/40" />
          <span className="text-white/60 font-semibold tracking-widest">NITE TV</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl font-semibold border border-white/5"
          >
            <P.CornersOut size={18} /> {isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
          </button>
          
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl font-semibold border border-white/5"
          >
            <P.House size={18} /> Voltar ao Início
          </button>
        </div>
      </footer>
    </div>
  );
}
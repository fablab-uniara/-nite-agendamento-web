import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './lib/firebase'; 
import { Navbar } from './components/Navbar';
import Home from './pages/Home';
import Agendar from './pages/Agendar';
import Painel from './pages/Painel';
import Gerenciador from './pages/Gerenciador';
import AcessoRestrito from './pages/AcessoRestrito';
import MeusAgendamentos from './pages/MeusAgendamentos';
import Termos from './pages/Termos';
import Privacidade from './pages/Privacidade';
import { Footer } from './components/Rodape';

export default function App() {
  const [user, loading] = useAuthState(auth);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-nite-blue font-bold">
      <span className="animate-spin mr-3">🌀</span> Carregando Sistema NITE...
    </div>
  );

  return (
    <BrowserRouter>
      {/* Container Principal com Flexbox para empurrar o footer */}
      <div className="min-h-screen flex flex-col bg-slate-50">
        
        {/* ROTA PÚBLICA PRINCIPAL (Home com Navbar) */}
        <Routes>
          <Route path="/" element={
            <>
              <Navbar />
              <main className="flex-1"><Home /></main>
            </>
          } />

          {/* ROTA AGENDAR (Protegida com Navbar) */}
          <Route path="/agendar" element={
            user ? (
              <>
                <Navbar />
                <main className="flex-1"><Agendar /></main>
              </>
            ) : <Navigate to="/" />
          } />

          {/* ROTA MEUS AGENDAMENTOS */}
          <Route path="/meus-agendamentos" element={
            user ? (
              <>
                <Navbar />
                <main className="flex-1"><MeusAgendamentos /></main>
              </>
            ) : <Navigate to="/" />
          } />

          {/* ROTA ACESSO RESTRITO (Sem Navbar padrão, mas precisa de Footer) */}
          <Route path="/restrito" element={
            <div className="flex-1 flex flex-col"><AcessoRestrito /></div>
          } />

          {/* ROTA PAINEL TV (Protegida por PIN em tempo real) */}
          <Route path="/painel" element={<RotaPainel />} />
          
          {/* ROTA GERENCIADOR (Protegida com Navbar) */}
          <Route path="/gerenciador" element={
            user ? (
              <>
                <Navbar />
                <main className="flex-1"><Gerenciador /></main>
              </>
            ) : <Navigate to="/restrito" />
          } />

          {/* ROTAS LEGAIS (Públicas com Navbar) */}
          <Route path="/termos" element={<><Navbar /><main className="flex-1"><Termos /></main></>} />
          <Route path="/privacidade" element={<><Navbar /><main className="flex-1"><Privacidade /></main></>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>

        {/* INSERÇÃO GLOBAL DO RODAPÉ (Condicional: não aparece na TV) */}
        <ConditionalFooter />
      </div>
    </BrowserRouter>
  );
}

// Pequeno componente auxiliar para esconder o footer na TV
function ConditionalFooter() {
  const location = useLocation();
  if (location.pathname.includes('/painel')) return null;
  return <Footer />;
}

// Componente Guardião para forçar a leitura do sessionStorage em tempo real
function RotaPainel() {
  return sessionStorage.getItem('tv_auth') === 'true' 
    ? <Painel /> 
    : <Navigate to="/restrito" replace />;
}

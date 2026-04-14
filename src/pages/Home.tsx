import * as P from '@phosphor-icons/react';
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { buscarSeguranca } from '../lib/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';

export default function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [user] = useAuthState(auth); // Verifica se já está logado

  useEffect(() => {
    document.title = "Início | NITE Uniara";
  }, []);

  const handleAgendarLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email?.toLowerCase() || '';
      const config = await buscarSeguranca();

      // Verificação robusta: ignora maiúsculas/minúsculas nas chaves do mapa
      const listaEmails = config?.emailsPermitidos || {};
      const isProfessor = Object.keys(listaEmails).some(key => key.toLowerCase() === email);
      const isAdmin = config?.admins?.includes(email);
      const isHealthAdmin = config?.adminsSaude?.includes(email);

      if (isProfessor || isAdmin || isHealthAdmin) {
        navigate('/meus-agendamentos'); 
      } else {
        alert('Acesso negado. A sua conta não tem privilégios de Administrador. Em caso de dúvidas, entre em contato com: niteprojetos@gmail.com');
        await auth.signOut();
      }
    } catch (error) {
      console.error("Erro no login:", error);
      
      // Converte o erro desconhecido para um formato que o TypeScript entenda
      const err = error as { message?: string; code?: string };

      // Tratamento de erro específico para navegadores Mobile (WhatsApp/Instagram)
      if (err.message && err.message.includes('initial state')) {
        alert("⚠️ O seu navegador bloqueou o login seguro. Se abriu este link pelo WhatsApp ou Instagram, toque nos três pontinhos no canto superior e escolha 'Abrir no Chrome' ou 'Abrir no Safari'.");
      } else if (err.code === 'auth/popup-blocked') {
        alert("⚠️ Pop-up bloqueado. Por favor, permita a abertura de janelas para fazer o login com o Google.");
      } else {
        alert("❌ Erro ao conectar com o Google. Tente abrir o sistema diretamente no navegador nativo do seu celular (Chrome/Safari).");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="text-center mb-12 max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight mb-4">
          Bem-vindo ao <span className="text-nite-blue">NITE</span>
        </h1>
        <p className="text-lg text-slate-600">
          Núcleo de Inovação, Tecnologia e Empreendedorismo da Uniara.<br className="hidden sm:block" />
          Acesse o sistema de gestão e agendamentos.
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 w-full max-w-md text-center transform hover:-translate-y-1 transition-transform duration-300">
        <div className="w-16 h-16 bg-nite-blue text-white rounded-xl flex items-center justify-center text-3xl mb-6 mx-auto shadow-md">
          <P.CalendarDots size={32} weight="fill" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-3">Agendar Sala</h2>
        <p className="text-slate-500 mb-8 text-sm">
          Acesso exclusivo para professores e coordenadores cadastrados no sistema.
        </p>
        
        {/* SE LOGADO, mostra botão direto. SE NÃO, pede login do Google */}
        {user ? (
          <button
            onClick={() => navigate('/meus-agendamentos')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2"
          >
            <P.BookmarkSimple size={24} weight="bold" />
            Ir para Meus Agendamentos
          </button>
        ) : (
          <button
            onClick={handleAgendarLogin}
            disabled={loading}
            className="w-full bg-nite-blue hover:bg-blue-900 text-white font-bold py-4 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 disabled:opacity-70"
          >
            {loading ? (
              'Verificando permissão...'
            ) : (
              <>
                <P.GoogleLogo size={24} weight="bold" />
                Acessar com o Google
              </>
            )}
          </button>
        )}

        <p className="text-sm text-slate-500 mt-4 font-medium text-center">
          Utilize o seu e-mail institucional (@uniara.edu.br).
        </p>

        {/* LINKS DE TERMOS DA LGPD */}
        <p className="text-xs text-slate-400 mt-6 text-center leading-relaxed border-t border-slate-100 pt-4">
          Ao aceder ao sistema, declara estar de acordo com os nossos <br />
          <Link to="/termos" className="text-nite-blue font-semibold hover:underline">Termos de Uso</Link> e a <Link to="/privacidade" className="text-nite-blue font-semibold hover:underline">Política de Privacidade</Link>.
        </p>
      </div>
    </div>
  );
}
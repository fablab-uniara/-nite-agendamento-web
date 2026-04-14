import * as P from '@phosphor-icons/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { buscarSeguranca } from '../lib/firestore';

export default function AcessoRestrito() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePinSubmit = async () => {
    const config = await buscarSeguranca();
    if (config && config.pinMaster === pin) {
      sessionStorage.setItem('tv_auth', 'true'); // Libera a TV temporariamente no navegador
      navigate('/painel');
    } else {
      alert('PIN incorreto. Acesso negado.');
      setPin('');
    }
  };

  const handleAdminLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email?.toLowerCase() || '';
      const config = await buscarSeguranca();

      // Verifica se o e-mail está na lista de Admins (Geral) ou Admins da Saúde
      const isSuperAdmin = config?.admins?.includes(email);
      const isHealthAdmin = config?.adminsSaude?.includes(email);

      if (config && (isSuperAdmin || isHealthAdmin)) {
        navigate('/gerenciador');
      } else {
        alert('Acesso negado. A sua conta não tem privilégios de Administrador.');
        await auth.signOut();
      }
    } catch (error) {
      console.error("Erro no login:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
      <P.LockKey size={48} weight="fill" className="text-white/30 mb-4" />
      <h1 className="text-3xl font-black mb-10 tracking-widest text-center"> ACESSO RESTRITO NITE</h1>
      
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl">
        
        {/* Card Painel TV (PIN) */}
        <div className="flex-1 bg-white rounded-3xl p-8 text-slate-800 text-center shadow-2xl">
          <div className="text-5xl mb-4"><P.TelevisionSimple size={32} weight="fill" /></div>
          <h2 className="text-2xl font-bold mb-2">Painel TV</h2>
          <p className="text-slate-500 text-sm mb-8">Acesso exclusivo para a TV da recepção.</p>
          
          <input
            type="password"
            className="w-full border border-slate-300 rounded-xl px-4 py-4 text-center text-2xl font-bold tracking-widest text-slate-800 focus:outline-none focus:ring-2 focus:ring-nite-blue mb-4"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
            maxLength={6}
            placeholder="PIN Master"
          />
          <button onClick={handlePinSubmit} className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl hover:bg-slate-900 transition-colors">
            Acessar TV
          </button>
        </div>

        {/* Card Gerenciador (Admin Google) */}
        <div className="flex-1 bg-nite-blue rounded-3xl p-8 text-white text-center shadow-2xl border border-white/10">
          <div className="text-5xl mb-4"><P.GearSix size={32} weight="fill" /></div>
          <h2 className="text-2xl font-bold mb-2">Gerenciador</h2>
          <p className="text-white/70 text-sm mb-12">Acesso exclusivo para a gestão do NITE.</p>
          
          <button 
            onClick={handleAdminLogin}
            disabled={loading}
            className="w-full bg-white text-nite-blue font-bold py-4 rounded-xl hover:bg-slate-100 transition-colors flex justify-center items-center shadow-lg disabled:opacity-70"
          >
            {loading ? 'A verificar...' : 'Logar como Admin (Google)'}
          </button>
        </div>

      </div>
      <button onClick={() => navigate('/')} className="mt-12 text-white/50 hover:text-white underline text-sm transition-colors">
        Voltar para a tela inicial
      </button>
    </div>
  );
}
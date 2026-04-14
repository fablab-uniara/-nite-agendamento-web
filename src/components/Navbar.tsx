import { Link, useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import * as P from '@phosphor-icons/react';
import logo from '../assets/logo.png';
import uniaraLogo from '../assets/uniara-logo.svg';

export function Navbar() {
  const navigate = useNavigate();
  const [user] = useAuthState(auth);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <nav className="bg-nite-blue shadow-lg sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Lado Esquerdo: Logo NITE (Mantida igual) */}
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <img src={logo} alt="NITE GBX" className="w-9 h-9 rounded-lg object-cover" />
            <div>
              <span className="text-white font-black text-lg tracking-widest">NITE</span>
              <p className="text-white/60 text-xs leading-none hidden sm:block">Agendamentos e Reservas</p>
            </div>
          </Link>

          {/* Lado Direito: Controles e Logo Uniara */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              
              {/* Meus Agendamentos (Apenas para logados) */}
              {user && (
                <button
                  onClick={() => navigate('/meus-agendamentos')}
                  className="text-xs font-semibold text-white hover:text-white border border-white/30 hover:bg-white/10 rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <P.BookmarkSimple size={14} weight="bold" /> <span className="hidden sm:inline">Meus Agendamentos</span>
                </button>
              )}

              {/* Botão Restrito agora aparece SEMPRE (muda o texto se logado) */}
              <button
                onClick={() => navigate('/restrito')}
                className="text-xs font-semibold text-white/70 hover:text-white border border-white/20 hover:border-white/50 rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1.5"
              >
                <P.LockKey size={14} /> <span className="hidden sm:inline">{user ? 'Menu Restrito' : 'Acesso Restrito'}</span>
              </button>

              {user && (
                <>
                  <span className="text-xs text-white/50 hidden md:block font-medium border-l border-white/20 pl-3">
                    {user.email}
                  </span>
                  <button 
                    onClick={handleLogout}
                    title="Sair do sistema"
                    className="p-1.5 text-red-300 hover:text-white rounded-lg hover:bg-red-500 transition-colors"
                  >
                    <P.SignOut size={18} />
                  </button>
                </>
              )}
            </div>

            {/* DIVISOR VISUAL */}
            <div className="w-px h-6 bg-white/10 mx-1"></div>

            <img 
              src={uniaraLogo} 
              alt="Uniara" 
              className="h-10 w-auto object-contain py-1" 
              title="Universidade de Araraquara"
            />
          </div>

        </div>
      </div>
    </nav>
  );
}
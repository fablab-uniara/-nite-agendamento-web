import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/logo.png';

const NAV_LINKS = [
  { to: '/', label: 'Início' },
  { to: '/agendar', label: 'Agendar' },
  { to: '/painel', label: 'Painel TV' },
  { to: '/gerenciador', label: 'Gerenciador' },
];

export function Navbar() {
  const { pathname } = useLocation();

  return (
    <nav className="bg-nite-blue shadow-lg sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Brand */}
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <img src={logo} alt="NITE" className="w-9 h-9 rounded-lg object-cover" />
            <div>
              <span className="text-white font-black text-lg tracking-widest">NITE</span>
              <p className="text-white/60 text-xs leading-none hidden sm:block">Agendamento de Espaços</p>
            </div>
          </Link>

          {/* Links */}
          <div className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

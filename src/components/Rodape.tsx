import * as P from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import logoNite from '../assets/logo.png';
import logoUniara from '../assets/uniara-logo.svg';

export function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      
      {/* Aviso de Cookies Embutido */}
      <div className="bg-slate-100 py-2.5 px-6 border-b border-slate-200 text-center text-xs text-slate-600">
        <P.Info size={16} className="inline mr-1.5 align-text-bottom text-nite-blue" />
        Este sistema utiliza cookies essenciais (autenticação do Google) para garantir o seu acesso seguro. 
        Ao continuar navegando, você concorda com a nossa <Link to="/privacidade" className="text-nite-blue font-bold hover:underline">Política de Privacidade</Link>.
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* Esquerda: Logos e Direitos */}
        <div className="flex flex-col items-center md:items-start gap-4">
          <div className="flex items-center gap-4">
            <img src={logoNite} alt="Logo NITE" className="h-9 w-9 rounded-lg object-cover shadow-sm" />
            <img src={logoUniara} alt="Logo Uniara" className="h-9 w-auto" />
          </div>
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-1 text-nite-blue mb-1">
              <P.Copyright size={14} />
              <span className="font-bold text-xs uppercase tracking-wider">NITE Uniara — 2026</span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
              Sistema desenvolvido por GBX Learning Tools.<br />
              (Direitos de uso cedidos para NITE - Uniara)
            </p>
          </div>
        </div>

        {/* Direita: Links Legais */}
        <div className="flex flex-col items-center md:items-end gap-3">
          <Link to="/termos" className="text-sm text-slate-600 hover:text-nite-blue font-semibold transition-colors flex items-center gap-2">
            <P.FileText size={18} /> Termos de Uso
          </Link>
          <Link to="/privacidade" className="text-sm text-slate-600 hover:text-nite-blue font-semibold transition-colors flex items-center gap-2">
            <P.ShieldCheck size={18} /> Política de Privacidade (LGPD)
          </Link>
        </div>
      </div>
    </footer>
  );
}
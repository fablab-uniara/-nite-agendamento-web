import * as P from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

export default function Privacidade() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <button onClick={() => navigate(-1)} className="text-nite-blue font-semibold flex items-center gap-2 hover:underline mb-8">
        <P.ArrowLeft size={20} /> Voltar
      </button>
      <h1 className="text-3xl font-black text-slate-800 mb-6">Política de Privacidade (LGPD)</h1>
      <div className="prose prose-slate max-w-none text-slate-600 text-sm space-y-4">
        <p>O NITE - Uniara valoriza a sua privacidade e está em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018).</p>
        <h3 className="text-lg font-bold text-slate-800 mt-6">1. Coleta de Dados</h3>
        <p>Coletamos apenas os dados estritamente necessários para a prestação do serviço de agendamento de salas: <strong>Nome, E-mail Institucional e Telefone/WhatsApp</strong>.</p>
        <h3 className="text-lg font-bold text-slate-800 mt-6">2. Finalidade do Uso</h3>
        <p>Os seus dados são utilizados exclusivamente para identificar o responsável pela reserva do espaço e para contatos estritamente relacionados ao uso das instalações do NITE.</p>
        <h3 className="text-lg font-bold text-slate-800 mt-6">3. Compartilhamento e Segurança</h3>
        <p>Os seus dados não serão vendidos, alugados ou compartilhados com terceiros. Eles ficam armazenados em servidores seguros (Google Firebase) com acesso restrito apenas aos administradores do sistema.</p>
        <h3 className="text-lg font-bold text-slate-800 mt-6">4. Uso de Cookies</h3>
        <p>Utilizamos cookies estritamente necessários para manter a sua sessão ativa e segura após o login com a conta Google. Não utilizamos cookies de rastreamento para fins de marketing.</p>
      </div>
    </div>
  );
}
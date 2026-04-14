import * as P from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

export default function Termos() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <button onClick={() => navigate(-1)} className="text-nite-blue font-semibold flex items-center gap-2 hover:underline mb-8">
        <P.ArrowLeft size={20} /> Voltar
      </button>
      <h1 className="text-3xl font-black text-slate-800 mb-6">Termos de Uso</h1>
      <div className="prose prose-slate max-w-none text-slate-600 text-sm space-y-4">
        <p>Bem-vindo ao sistema de Agendamentos do NITE - Uniara.</p>
        <h3 className="text-lg font-bold text-slate-800 mt-6">1. Uso do Sistema</h3>
        <p>Este sistema é de uso exclusivo de professores, coordenadores e colaboradores autorizados da Universidade de Araraquara (Uniara). O acesso é pessoal e intransferível, devendo ser feito obrigatoriamente através do e-mail institucional (@uniara.edu.br).</p>
        <h3 className="text-lg font-bold text-slate-800 mt-6">2. Regras de Agendamento</h3>
        <p>Ao realizar um agendamento, o usuário compromete-se a utilizar o espaço na data e horário marcados. Caso haja desistência, é responsabilidade do usuário cancelar o agendamento no sistema (através do menu "Meus Agendamentos") com antecedência para liberar o espaço para outros colegas.</p>
        <h3 className="text-lg font-bold text-slate-800 mt-6">3. Uso dos Espaços e Equipamentos</h3>
        <p>Os espaços devem ser utilizados para fins estritamente acadêmicos e institucionais. O solicitante é responsável por zelar pela integridade da sala e dos recursos audiovisuais solicitados.</p>
      </div>
    </div>
  );
}
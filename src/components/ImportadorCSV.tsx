import * as P from '@phosphor-icons/react';
import { useState } from 'react';
import { criarAgendamento, verificarConflito } from '../lib/firestore';
// import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
// import { db } from '../lib/firebase';

export function ImportadorCSV() {
  const [loading, setLoading] = useState(false);
  const [relatorio, setRelatorio] = useState<{ sucesso: number; conflitos: string[] } | null>(null);

  // Função robusta para ler linhas de CSV ignorando vírgulas dentro de aspas
  const parseCSVLine = (text: string) => {
    const ret: string[] = []; // Alterado de let para const
    let inQuote = false;
    let value = '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i]; // Alterado de let para const
      if (char === '"') inQuote = !inQuote;
      else if (char === ';' && !inQuote) { ret.push(value.trim()); value = ''; }
      else value += char;
    }
    ret.push(value.trim());
    return ret;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setRelatorio(null);
    let sucessoCount = 0;
    const conflitosList: string[] = [];

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim() !== '');
      
      // Ignora a primeira linha (Cabeçalho: ID,SALA,DATA,INICIO...)
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (row.length < 9) continue; // Salta linhas inválidas

        // Extrai as colunas da planilha (índices 0 a 8)
        const [oldId, sala, data, inicio, fim, curso, disciplina, usuario, qtd] = row;

        // Formatar DATA de "DD/MM/YYYY" para "YYYY-MM-DD" (Padrão do Firebase)
        let dataFormatada = data.trim();
        if (dataFormatada.includes('/')) {
          const partes = dataFormatada.split('/');
          if (partes.length === 3) {
            // partes[0] = DD, partes[1] = MM, partes[2] = YYYY
            dataFormatada = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
          }
        }

        // Prevenir erro se a hora vier vazia e cortar para "HH:MM"
        const horaInicio = inicio ? inicio.substring(0, 5) : ''; 
        const horaFim = fim ? fim.substring(0, 5) : '';
        const quantidadeStr = String(qtd);

        try {
          // PROBLEMA 2: Verificar Conflito antes de salvar
          const temConflito = await verificarConflito(sala, dataFormatada, horaInicio, horaFim);

          if (!temConflito) {
            // PROBLEMA 1: Preencher dados vazios
            await criarAgendamento({
              espaco: sala,
              data: dataFormatada,
              horaInicio: horaInicio,
              horaFim: horaFim,
              curso: curso,
              disciplina: disciplina,
              nomeResponsavel: usuario,
              quantidadePessoas: quantidadeStr,
              tipoUso: '', // Ficará vazio conforme solicitou
              telefoneResponsavel: '', 
              observacoes: 'Agendamento importado do sistema antigo',
            });
            sucessoCount++;
          } else {
            // Regista o conflito para mostrar depois
            conflitosList.push(`ID Antigo: ${oldId} | Sala: ${sala} | Data: ${dataFormatada} | Horário: ${horaInicio}-${horaFim} | Resp: ${usuario}`);
          }
        } catch (error) {
          console.error("Erro no Firebase:", error); // Usamos a variável para não dar erro no ESLint
          conflitosList.push(`Erro ao importar ID ${oldId}: Erro no banco de dados.`);
        }
      }

      setRelatorio({ sucesso: sucessoCount, conflitos: conflitosList });
      setLoading(false);
    };

    reader.readAsText(file);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-6">
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <P.UploadSimple size={24} className="text-nite-blue" />
        Importar Agendamentos Antigos
      </h2>
      
      <p className="text-sm text-slate-500 mb-6">
        Selecione o seu ficheiro .CSV para importar. O sistema irá automaticamente preencher os campos vazios e saltar os agendamentos que entrarem em conflito de horário.
      </p>

      <div className="mb-6">
        <input 
          type="file" 
          accept=".csv" 
          onChange={handleFileUpload}
          disabled={loading}
          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-nite-blue file:text-white hover:file:bg-blue-900 transition-colors"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-nite-blue font-bold">
          <P.Spinner size={24} className="animate-spin" /> Processando importação, aguarde...
        </div>
      )}

      {/* Relatório Final */}
      {relatorio && (
        <div className="mt-6 border-t border-slate-100 pt-6">
          <h3 className="font-bold text-lg mb-2">Relatório de Importação:</h3>
          <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl mb-4 flex items-center gap-2">
            <P.CheckCircle size={24} weight="fill" />
            <strong>{relatorio.sucesso}</strong> agendamentos importados com sucesso!
          </div>

          {relatorio.conflitos.length > 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="text-red-700 font-bold flex items-center gap-2 mb-3">
                <P.WarningCircle size={24} weight="fill" />
                {relatorio.conflitos.length} agendamentos NÃO importados por conflito (Sala já ocupada):
              </div>
              <ul className="text-xs text-red-600 max-h-64 overflow-y-auto space-y-1 list-disc pl-5">
                {relatorio.conflitos.map((conf, index) => (
                  <li key={index}>{conf}</li>
                ))}
              </ul>
            </div>
          ) : (
             <div className="bg-slate-50 text-slate-500 p-4 rounded-xl">Nenhum conflito detetado. Todos os dados foram importados!</div>
          )}
        </div>
      )}
    </div>
  );
}
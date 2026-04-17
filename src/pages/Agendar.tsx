import * as P from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import type { Parametros, Agendamento } from '../lib/firestore';
import {
  DEFAULT_PARAMETROS,
  buscarParametros,
  criarAgendamento,
  verificarConflito,
  buscarSeguranca,
  applyPhoneMask,
  brToIso,
  isoToBr,
  todayIso,
} from '../lib/firestore';

interface FormData {
  espaco: string;
  tipoUso: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  curso: string;
  disciplina: string;
  conteudo: string;
  quantidadePessoas: string;
  nomeResponsavel: string;
  telefoneResponsavel: string;
  observacoes: string;
}

const EMPTY: FormData = {
  espaco: '', tipoUso: '', data: isoToBr(todayIso()),
  horaInicio: '', horaFim: '', curso: '', disciplina: '', conteudo: '',
  quantidadePessoas: '', nomeResponsavel: '', telefoneResponsavel: '', observacoes: '',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-slate-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// Mudamos de "text-sm" para "text-base sm:text-sm" para evitar o zoom automático no iPhone
const inputCls = "w-full border border-slate-300 rounded-xl px-4 py-3 text-base sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-nite-blue/40 focus:border-nite-blue transition-all";
const selectCls = inputCls + " cursor-pointer";

// Função Sênior para verificar a capacidade do espaço
const getCapacidadeMaxima = (espaco: string) => {
  if (!espaco) return null;
  const nome = espaco.toLowerCase().replace(/\s+/g, '');
  if (nome.includes('classlab1')) return 114;
  if (nome.includes('classlab2')) return 50;
  if (nome.includes('fablab')) return 40;
  return null; // Sem limite definido (ex: espaços da Saúde)
};

export default function Agendar() {
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [params, setParams] = useState<Parametros>(DEFAULT_PARAMETROS);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [recursos, setRecursos] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<Agendamento | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const handleVoltar = async () => {
    if (!user?.email) {
      navigate('/');
      return;
    }

    try {
      const email = user.email.toLowerCase();
      const config = await buscarSeguranca();

      // Verifica se é um dos Admins (Geral ou Saúde)
      const isSuperAdmin = config?.admins?.includes(email);
      const isHealthAdmin = config?.adminsSaude?.includes(email);

      if (isSuperAdmin || isHealthAdmin) {
        navigate('/gerenciador'); // Rota do Gerenciador
      } else {
        navigate('/meus-agendamentos'); // Rota do Professor
      }
    } catch (error) {
      console.error("Erro ao redirecionar:", error);
      navigate('/');
    }
  };

  const dataMax = new Date();
  dataMax.setDate(dataMax.getDate() + 15);
  const limiteIso = new Date(dataMax.getTime() - (dataMax.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  const hojeIso = todayIso();

  useEffect(() => {
    buscarParametros().then(setParams);
    
    // Verifica se o usuário atual é Super Admin para liberar o calendário
    if (user?.email) {
      buscarSeguranca().then(config => {
        const email = user.email!.toLowerCase();
        setIsSuperAdmin(config?.admins?.includes(email) || false);
      });
    }
  }, [user]);

  const update = (field: keyof FormData) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const espacosFiltrados = params.espacos.filter(espaco => {
    const nome = espaco.toLowerCase().replace(/\s+/g, '');
    const isTech = nome.includes('fablab') || nome.includes('classlab');
    const isNite = nome.includes('nite');
    const curso = form.curso;

    // REGRA 1: Espaço "NITE" somente deverá ser visível quando "Uso Interno" for selecionado.
    if (isNite) {
      return curso === 'Uso Interno';
    }

    // Lista oficial dos cursos da Saúde
    const cursosSaude = ['Medicina', 'Farmácia', 'Enfermagem', 'Psicologia', 'Fisioterapia', 'Educação Física'];

    // REGRA 2: Espaços da Saúde e Espaços Tech visíveis para cursos da Saúde (e Uso Interno)
    if (cursosSaude.includes(curso) || curso === 'Uso Interno') {
      return true; // Retorna tudo o que sobrou (Saúde + Tech)
    }

    // REGRA 3: Espaços Tech visíveis para cursos que NÃO forem da saúde (ex: Design, Publicidade)
    return isTech;
  });

  const opcoesTipoUso = [...params.tiposUso].sort();
  
// Verifica se a sala atual é Class Lab ou Fablab (remove espaços para evitar erros)
  const espacoLimpo = form.espaco.toLowerCase().replace(/\s+/g, '');
  const mostrarRecursos = espacoLimpo.includes('class') || espacoLimpo.includes('fablab');
  const isFablab = espacoLimpo.includes('fablab');
  
  const validate = (): string | null => {
    // Validação de data e hora no passado
    const dataIso = brToIso(form.data);
    const hoje = todayIso();

    const qtd = Number(form.quantidadePessoas);
    if (!form.quantidadePessoas || qtd < 1) return 'A quantidade mínima é de 1 pessoa.';
    
    const maxCap = getCapacidadeMaxima(form.espaco);
    if (maxCap && qtd > maxCap) {
      return `A capacidade máxima do ${form.espaco} é de ${maxCap} pessoas.`;
    }
    
    if (dataIso < hoje) return 'Não é possível agendar em uma data que já passou.';
    
    if (dataIso === hoje) {
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();
      const [h, m] = form.horaInicio.split(':').map(Number);
      if ((h * 60 + m) < currentMin) return 'O horário de início não pode estar no passado.';
    }
    
    if (!isSuperAdmin && dataIso > limiteIso) {
      return 'Você só pode agendar horários com no máximo 15 dias de antecedência.';
    }

    if (!form.nomeResponsavel.trim()) return 'Informe o nome do responsável.';
    if (!form.espaco) return 'Selecione o espaço.';
    if (!form.tipoUso) return 'Selecione o tipo de uso.';
    if (!form.data || form.data.length < 10) return 'Informe a data no formato DD/MM/AAAA.';
    if (!form.horaInicio || form.horaInicio.length < 5) return 'Informe a hora de início.';
    if (!form.horaFim || form.horaFim.length < 5) return 'Informe a hora de fim.';
    if (form.horaFim <= form.horaInicio) return 'A hora de fim deve ser posterior à hora de início.';
    if (!form.curso) return 'Selecione o curso.';
    if (!form.quantidadePessoas) return 'Informe a quantidade de pessoas.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setConflict(null);
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    try {
      const isoDate = brToIso(form.data);
      const conflito = await verificarConflito(form.espaco, isoDate, form.horaInicio, form.horaFim);
      if (conflito) { setConflict(conflito); setSaving(false); return; }
      await criarAgendamento({
        espaco: form.espaco,
        tipoUso: recursos === 'Nenhum' || !recursos ? form.tipoUso : `${form.tipoUso} (Recurso: ${recursos})`,
        data: brToIso(form.data),
        horaInicio: form.horaInicio,
        horaFim: form.horaFim,
        curso: form.curso,
        disciplina: form.disciplina.trim(),
        conteudo: form.conteudo || '',
        quantidadePessoas: form.quantidadePessoas,
        nomeResponsavel: form.nomeResponsavel.trim(),
        telefoneResponsavel: form.telefoneResponsavel || '',
        emailResponsavel: user?.email?.toLowerCase() || '',
        observacoes: form.observacoes.trim(),
      });
      setSuccess(true);
    } catch (error) {
      setError('Erro ao salvar: ' + (error instanceof Error ? error.message : 'tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl"><P.CheckCircle size={18} className="inline-block mr-1.5" /></span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Agendamento Confirmado!</h2>
          <p className="text-slate-500 mb-2">
            <strong>{form.espaco}</strong> reservado para <strong>{form.data}</strong>
          </p>
          <p className="text-slate-500 mb-6">
            Das <strong>{form.horaInicio}</strong> às <strong>{form.horaFim}</strong>
          </p>
          <p className="text-slate-400 text-sm mb-8">
            Responsável: {form.nomeResponsavel}
            {form.telefoneResponsavel && ` • ${form.telefoneResponsavel}`}
          </p>
          <button
            onClick={() => { setSuccess(false); setForm(EMPTY); }}
            className="w-full bg-nite-blue text-white font-bold py-3 rounded-xl hover:bg-blue-900 transition-colors"
          >
            Fazer outro agendamento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        
        {/* Botão de Voltar Inteligente */}
        {user && (
          <button
            onClick={handleVoltar}
            className="mb-6 flex items-center gap-2 text-slate-500 hover:text-nite-blue font-semibold transition-colors group"
          >
            <P.ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            Voltar para o sistema
          </button>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-black text-nite-blue">Agendar Espaço</h1>
          <p className="text-slate-500 mt-1">Preencha os campos abaixo para reservar um espaço do NITE.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:p-8">
          
          {/* Bloco 1: Responsável */}
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">RESPONSÁVEL</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nome do Responsável" required>
                <input type="text" className={inputCls} value={form.nomeResponsavel} onChange={(e) => update('nomeResponsavel')(e.target.value)} placeholder="Nome completo" />
              </Field>
              <Field label="Telefone / Celular">
                <input type="text" className={inputCls} value={form.telefoneResponsavel} onChange={(e) => update('telefoneResponsavel')(applyPhoneMask(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
              </Field>
            </div>
          </div>

          {/* Bloco 2: Classe / Turma */}
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">CLASSE / TURMA</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Curso" required>
                <select className={selectCls} value={form.curso} onChange={(e) => { update('curso')(e.target.value); update('espaco')(''); setRecursos(''); update('quantidadePessoas')(''); }}>
                  <option value="">Selecione o curso...</option>
                  {params.cursos.map((c) => ( c === '— Pós-Graduação —' ? <option key={c} value="" disabled>──── Pós-Graduação ────</option> : <option key={c} value={c}>{c}</option> ))}
                </select>
              </Field>

              <Field label="Disciplina" required>
                <input type="text" className={inputCls} value={form.disciplina} onChange={(e) => update('disciplina')(e.target.value)} placeholder="Nome da disciplina" />
              </Field>

              {['Medicina', 'Enfermagem', 'Fisioterapia'].includes(form.curso) && params.conteudos?.[form.curso] ? (
                <div className="sm:col-span-2">
                  <Field label="Conteúdo da Aula (Selecione de 1 a 5)">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1 max-h-52 overflow-y-auto p-3 border border-slate-300 rounded-xl bg-white focus-within:border-nite-blue focus-within:ring-1 focus-within:ring-nite-blue transition-all">
                      {params.conteudos[form.curso].map((cont: string) => {
                        const selecionados = form.conteudo ? form.conteudo.split(' • ') : [];
                        const isSelected = selecionados.includes(cont);
                        return (
                          <label key={cont} className="flex items-start gap-2 cursor-pointer group">
                            <input type="checkbox" className="mt-0.5 flex-shrink-0 w-4 h-4 accent-blue-600 cursor-pointer" checked={isSelected} onChange={() => { if (isSelected) { update('conteudo')(selecionados.filter(c => c !== cont).join(' • ')); } else { if (selecionados.length >= 5) { alert('Você pode selecionar no máximo 5 conteúdos.'); } else { update('conteudo')([...selecionados, cont].join(' • ')); } } }} />
                            <span className="text-sm text-slate-700 group-hover:text-blue-600 transition-colors leading-snug break-words">{cont}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-xs font-medium text-slate-500">
                      Selecionados: <span className={form.conteudo ? 'text-nite-blue font-bold' : ''}>{form.conteudo ? form.conteudo.split(' • ').length : 0}/5</span>
                    </div>
                  </Field>
                </div>
              ) : (
                <div className="hidden"></div>
              )}
            </div>
          </div>

          {/* Bloco 3: Espaço e Tipo de Uso */}
          <div className="mb-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">ESPAÇO E TIPO DE USO</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Espaço" required>
                <select className={`${selectCls} ${!form.curso ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`} value={form.espaco} disabled={!form.curso} onChange={(e) => { update('espaco')(e.target.value); setRecursos(''); }}>
                  <option value="">{!form.curso ? '⚠️ Selecione o curso acima primeiro...' : 'Selecione o espaço...'}</option>
                  {espacosFiltrados.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </Field>
              
              <Field label="Tipo de Uso" required>
                <select className={selectCls} value={form.tipoUso} onChange={(e) => update('tipoUso')(e.target.value)}>
                  <option value="">Selecione...</option>
                  {opcoesTipoUso.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>

              <Field label={`Quantidade de Pessoas ${getCapacidadeMaxima(form.espaco) ? `(Máx: ${getCapacidadeMaxima(form.espaco)})` : ''}`}>
                <input 
                  type="number" 
                  min="1" 
                  max={getCapacidadeMaxima(form.espaco) || ''} 
                  className={`${inputCls} ${!form.espaco ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`} 
                  value={form.quantidadePessoas} 
                  disabled={!form.espaco} 
                  onChange={(e) => update('quantidadePessoas')(e.target.value)} 
                  placeholder={!form.espaco ? "⚠️ Selecione o espaço..." : "Mínimo 1"} 
                />
              </Field>

              {mostrarRecursos ? (
                <Field label="Recursos audiovisuais a serem utilizados:">
                  <select className={selectCls} value={recursos} onChange={(e) => setRecursos(e.target.value)}>
                    <option value="">Selecione o recurso...</option>
                    <option value="Nenhum">Nenhum</option>
                    <option value="Notebook">Notebook</option>
                    <option value="Projetor">Projetor</option>
                    {!isFablab && (
                      <>
                        <option value="Lousa Digital (TV interativa)">Lousa Digital (TV interativa)</option>
                        <option value="Som (Microfone com Caixa)">Som (Microfone com Caixa)</option>
                      </>
                    )}
                  </select>
                </Field>
              ) : (
                <div className="hidden sm:block"></div>
              )}
            </div>
          </div>

          {/* Bloco 4: Data e Horário */}
          <div className="mb-8">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Data e Horário</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Data:" required>
                <input
                  type="date"
                  className={inputCls}
                  value={brToIso(form.data)}
                  min={hojeIso}
                  max={isSuperAdmin ? undefined : limiteIso}
                  onChange={(e) => {
                    if (e.target.value) {
                      setForm({ ...form, data: isoToBr(e.target.value) });
                    }
                  }}
                />
              </Field>

              <Field label="Início:" required>
                <input
                  type="time"
                  className={inputCls}
                  value={form.horaInicio}
                  onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                />
              </Field>

              <Field label="Término:" required>
                <input
                  type="time"
                  className={inputCls}
                  value={form.horaFim}
                  onChange={(e) => setForm({ ...form, horaFim: e.target.value })}
                />
              </Field>
            </div>
          </div>

          {/* Bloco 5: Observações */}
          <div className="mb-8">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Observações (Opcional)</h2>
            <textarea
              className={`${inputCls} min-h-[100px] resize-y`}
              value={form.observacoes}
              onChange={(e) => update('observacoes')(e.target.value)}
              placeholder="Ex: Lembrar de ligar o ar-condicionado, etc."
            />
          </div>
          
          {/* Conflict warning */}
          {conflict && (
            <div className="mb-4 bg-red-50 border border-red-300 rounded-xl p-4 text-sm text-red-700">
              <strong className="flex items-center gap-1.5"><P.WarningCircle size={18} /> Conflito de horário!</strong> O espaço <strong>{conflict.espaco}</strong> já está
              reservado das <strong>{conflict.horaInicio}</strong> às <strong>{conflict.horaFim}</strong> por{' '}
              <strong>{conflict.nomeResponsavel}</strong> para <strong>{conflict.tipoUso}</strong>. Escolha outro horário ou espaço.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-300 rounded-xl p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-nite-blue text-white font-bold py-4 rounded-xl text-base hover:bg-blue-900 disabled:opacity-60 transition-colors shadow-md"
          >
            {saving ? 'Salvando...' : (
              <span className="flex items-center justify-center gap-2">
                <P.CheckCircle size={22} weight="bold" /> Confirmar Agendamento
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

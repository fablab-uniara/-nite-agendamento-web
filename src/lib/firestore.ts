import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Parametros {
  cursos: string[];
  tiposUso: string[];
  espacos: string[];
  conteudos?: Record<string, string[]>;
}

export interface Agendamento {
  id?: string;
  espaco: string;
  tipoUso: string;
  data: string;        // DD-MM-YYYY (internal)
  horaInicio: string;  // HH:MM
  horaFim: string;     // HH:MM
  curso: string;
  disciplina: string;
  conteudo?: string;
  quantidadePessoas: string;
  nomeResponsavel: string;
  telefoneResponsavel?: string;
  emailResponsavel?: string;
  observacoes?: string;
  criadoEm?: Timestamp;
}

// ─── Default data (fallback when Firestore is unavailable) ────────────────────

export const DEFAULT_PARAMETROS: Parametros = {
  cursos: [
    'Administração',
    'Arquitetura e Urbanismo',
    'Biologia',
    'Biomedicina',
    'Computação em Nuvem',
    'Design de Moda',
    'Design Digital',
    'Direito',
    'Economia',
    'Educação Física',
    'Enfermagem',
    'Engenharia Agronômica',
    'Engenharia Civil',
    'Engenharia de Computação',
    'Engenharia de Produção',
    'Engenharia Elétrica',
    'Estética e Cosmética',
    'Farmácia',
    'Fisioterapia',
    'Gestão Estratégica do Agronegócio',
    'Inteligência Artificial',
    'Medicina',
    'Medicina Veterinária',
    'Nutrição',
    'Odontologia',
    'Pedagogia',
    'Psicologia',
    'Publicidade e Propaganda',
    'Segurança da Informação',
    'Sistemas de Informação',
    '— Pós-Graduação —',
    'PPG em Biotecnologia em Medicina Regenerativa e Química Medicinal',
    'PPG em Ciências Odontológicas',
    'PPG em Desenvolvimento Territorial e Meio Ambiente',
    'PPG em Direito e Gestão de Conflitos',
    'PPG em Engenharia de Produção',
    'PPG em Processos de Ensino, Gestão e Inovação',
    'Mestrado em Direito',
    'Biologia e Nutrição (Junção)',
    'Uso Interno',
  ],
  tiposUso: ['Aula', 'Reunião', 'Palestra', 'Workshop', 'Manutenção', 'Simulação', 'Treinamento', 'Apresentação de TCC', 'Visita', 'Outros', 'Avaliação Prática'],
  espacos: [
    'Class Lab 1 (Cap. Máx. 114)',
    'Class Lab 2 (Cap. Máx. 50)',
    'Sala de Debriefing',
    'Sala UTI',
    'Sala - Consultório',
    'Sala Semi-Intensiva',
    'Sala 1 - Procedimentos',
    'Sala 2 - Habilidades',
    'Fab Lab',
    'NITE',
  ],
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** "DD/MM/AAAA" → "YYYY-MM-DD" */
export function brToIso(br: string): string {
  const [d, m, y] = br.split('/');
  if (!d || !m || !y) return '';
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** "YYYY-MM-DD" → "DD/MM/AAAA" */
export function isoToBr(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Today as "YYYY-MM-DD" */
export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Apply DD/MM/AAAA mask */
export function applyDateMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Apply HH:MM mask */
export function applyTimeMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** Apply phone mask (00) 00000-0000 */
export function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export async function buscarParametros(): Promise<Parametros> {
  try {
    const snap = await getDoc(doc(db, 'parametros', 'config'));
    if (snap.exists()) return snap.data() as Parametros;
  } catch { 
    /* Omitir o (_) remove a variável não utilizada */
  }
  return DEFAULT_PARAMETROS;
}

export async function criarAgendamento(data: Omit<Agendamento, 'id' | 'criadoEm'>): Promise<string> {
  const ref = await addDoc(collection(db, 'agendamentos'), {
    ...data,
    criadoEm: Timestamp.now(),
  });
  return ref.id;
}

export async function atualizarAgendamento(id: string, data: Partial<Agendamento>): Promise<void> {
  await updateDoc(doc(db, 'agendamentos', id), data);
}

export async function excluirAgendamento(id: string): Promise<void> {
  await deleteDoc(doc(db, 'agendamentos', id));
}

export function onAgendamentosHoje(callback: (items: Agendamento[]) => void): () => void {
  const today = todayIso();
  const q = query(collection(db, 'agendamentos'), where('data', '==', today));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Agendamento));
    items.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    callback(items);
  });
}

export async function buscarTodosAgendamentos(): Promise<Agendamento[]> {
  const snap = await getDocs(collection(db, 'agendamentos'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Agendamento))
    .sort((a, b) => b.data.localeCompare(a.data) || a.horaInicio.localeCompare(b.horaInicio));
}

export async function verificarConflito(
  espaco: string,
  data: string,
  horaInicio: string,
  horaFim: string,
  excludeId?: string
): Promise<Agendamento | null> {
  const q = query(
    collection(db, 'agendamentos'),
    where('espaco', '==', espaco),
    where('data', '==', data)
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    if (d.id === excludeId) continue;
    const ag = d.data() as Agendamento;
    if (horaInicio < ag.horaFim && horaFim > ag.horaInicio) return { id: d.id, ...ag };
  }
  return null;
}

export interface SegurancaConfig {
  pinMaster: string;
  emailsPermitidos: Record<string, string>; // O Map que criámos no Firebase
  admins?: string[];
  adminsSaude?: string[];
}

// Função para buscar a configuração de segurança
export async function buscarSeguranca(): Promise<SegurancaConfig | null> {
  try {
    const snap = await getDoc(doc(db, 'seguranca', 'acesso'));
    if (snap.exists()) {
      return snap.data() as SegurancaConfig;
    }
  } catch (error) {
    console.error("Erro ao buscar segurança:", error);
  }
  return null;
}

// Função para buscar apenas os agendamentos de um usuário específico
export async function buscarAgendamentosPorEmail(email: string): Promise<Agendamento[]> {
  const q = query(
    collection(db, 'agendamentos'), 
    where('emailResponsavel', '==', email.toLowerCase())
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Agendamento))
    .sort((a, b) => b.data.localeCompare(a.data) || a.horaInicio.localeCompare(b.horaInicio));
}

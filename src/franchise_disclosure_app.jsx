import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FileStack, Plus, Download, Copy, Eye, ArrowLeft, ArrowRight,
  CircleCheck, Circle, Pencil, AlertTriangle, Info, Trash2, Upload,
  HelpCircle, X, Search, Printer, Building2, Calendar, Users,
  Briefcase, Scale, Wallet, ShieldCheck, GraduationCap, Store,
  ChevronRight, FileText, Check, Hash, Loader2,
} from 'lucide-react';
if (typeof window !== 'undefined' && !window.storage) {
  window.storage = {
    async list(prefix = '') {
      const keys = Object.keys(localStorage).filter((key) => key.startsWith(prefix));
      return { keys };
    },

    async get(key) {
      const value = localStorage.getItem(key);
      return value === null ? null : { value };
    },

    async set(key, value) {
      localStorage.setItem(key, value);
      return true;
    },

    async delete(key) {
      localStorage.removeItem(key);
      return true;
    },
  };
}

// =========================================================================
// DESIGN TOKENS
// =========================================================================
const C = {
  bg: '#FAF8F4',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F1EA',
  border: '#E8E4DA',
  borderStrong: '#D0CABB',
  ink: '#1A1A1A',
  inkMuted: '#5C5C5C',
  inkSubtle: '#8E8980',
  accent: '#1B3A5C',
  accentLight: '#E8EEF5',
  accentMid: '#3D5F82',
  success: '#2D5F3F',
  successLight: '#E8F0E9',
  warning: '#8C5A1B',
  warningLight: '#F5EDDB',
  danger: '#A8323A',
  dangerLight: '#F5E5E6',
};

// =========================================================================
// DOMAIN CONSTANTS
// =========================================================================
const SECTIONS = [
  { id: 1, roman: 'Ⅰ', title: '가맹본부의 일반 현황', short: '일반 현황', icon: Building2 },
  { id: 2, roman: 'Ⅱ', title: '가맹본부의 가맹사업 현황', short: '가맹사업 현황', icon: Store },
  { id: 3, roman: 'Ⅲ', title: '가맹본부와 그 임원의 법 위반 사실', short: '법 위반 사실', icon: Scale },
  { id: 4, roman: 'Ⅳ', title: '가맹점사업자의 부담', short: '가맹점사업자 부담', icon: Wallet },
  { id: 5, roman: 'Ⅴ', title: '영업활동에 대한 조건 및 제한', short: '영업활동 조건', icon: ShieldCheck },
  { id: 6, roman: 'Ⅵ', title: '가맹사업의 영업 개시에 관한 상세한 절차와 소요기간', short: '영업개시 절차', icon: Calendar },
  { id: 7, roman: 'Ⅶ', title: '가맹본부의 경영 및 영업활동 등에 대한 지원', short: '경영·영업 지원', icon: Briefcase },
  { id: 8, roman: 'Ⅷ', title: '교육·훈련에 대한 설명', short: '교육·훈련', icon: GraduationCap },
  { id: 9, roman: 'Ⅸ', title: '가맹본부의 직영점 현황', short: '직영점 현황', icon: Users },
];

// =========================================================================
// DATA MODEL
// =========================================================================
function emptyDoc(brandName = '') {
  const now = new Date().toISOString();
  return {
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    brandName: brandName || '신규 브랜드',
    status: 'draft',
    createdAt: now,
    lastModified: now,
    currentStep: 1,
    completedSteps: [],
    data: {
      s1: {
        company: {
          상호: '', 영업표지: brandName, 주소: '', 대표자: '',
          법인등록번호: '', 사업자등록번호: '',
          홈페이지: '', 이메일: '', 대표전화: '', 대표팩스: '',
          담당부서: '', 담당전화: '',
        },
        executives: [],
        employees: { 사무직: '', 영업직: '', 기타: '' },
        related: [],
      },
      s2: {
        startDate: '', 업종: '',
        history: [],
        storeStats: {
          가맹점: { y1: '', y2: '', y3: '' },
          직영점: { y1: '', y2: '', y3: '' },
        },
        adSpend: { y1: '', y2: '', y3: '' },
        가맹금예치: '',
      },
      s3: {
        시정조치: { applicable: null, items: [] },
        민사소송: { applicable: null, items: [] },
        형사선고: { applicable: null, items: [] },
      },
      s4: {
        영업개시전: { 가입비: '', 교육비: '', 보증금: '', 인테리어비: '', 기기설비비: '', 초도물품비: '' },
        영업중: { 로열티: '', 광고분담금: '', 전산이용료: '' },
        계약종료후: '',
      },
      s5: { 필수구매물품: '', 영업지역보호: '', 계약기간: '', 갱신조건: '', 해지조건: '' },
      s6: { 절차: '', 소요기간: '', 분쟁해결: '' },
      s7: { 점포환경개선: '', 판촉인력지원: '', 자문: '', 신용제공: '' },
      s8: { 교육내용: '', 교육시간: '', 교육비용: '', 불참시불이익: '' },
      s9: { directStores: [], 평균운영기간: '', 평균매출액: '' },
    },
  };
}

// =========================================================================
// PERSISTENCE
// =========================================================================
async function loadAllDocs() {
  try {
    const result = await window.storage.list('doc:');
    if (!result || !result.keys || result.keys.length === 0) return [];
    const out = [];
    for (const k of result.keys) {
      try {
        const r = await window.storage.get(k);
        if (r) out.push(JSON.parse(r.value));
      } catch (e) { /* skip */ }
    }
    out.sort((a, b) => (b.lastModified || '').localeCompare(a.lastModified || ''));
    return out;
  } catch (e) {
    return [];
  }
}

async function saveDoc(doc) {
  try {
    doc.lastModified = new Date().toISOString();
    await window.storage.set(`doc:${doc.id}`, JSON.stringify(doc));
    return true;
  } catch (e) { return false; }
}

async function deleteDocStorage(id) {
  try { await window.storage.delete(`doc:${id}`); return true; } catch (e) { return false; }
}

// =========================================================================
// VALIDATION & PROGRESS
// =========================================================================
function isStepComplete(doc, stepId) {
  const s = doc.data;
  switch (stepId) {
    case 1: return !!(s.s1.company.상호 && s.s1.company.대표자 && s.s1.company.주소);
    case 2: return !!(s.s2.startDate && s.s2.업종);
    case 3: return ['시정조치','민사소송','형사선고'].every(k => s.s3[k].applicable !== null);
    case 4: return !!(s.s4.영업개시전.가입비 || s.s4.영업개시전.보증금);
    case 5: return !!s.s5.계약기간;
    case 6: return !!s.s6.절차;
    case 7: return !!(s.s7.점포환경개선 || s.s7.판촉인력지원);
    case 8: return !!s.s8.교육내용;
    case 9: return s.s9.평균운영기간 !== '' || s.s9.directStores.length > 0;
    default: return false;
  }
}

function progressPct(doc) {
  const completed = SECTIONS.filter(s => isStepComplete(doc, s.id)).length;
  return Math.round((completed / SECTIONS.length) * 100);
}

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// =========================================================================
// PRIMITIVE UI
// =========================================================================
function Btn({ children, variant = 'ghost', size = 'md', onClick, disabled, type = 'button', style: extra }) {
  const base = {
    fontFamily: 'inherit', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid', borderRadius: 6, transition: 'all 0.12s ease',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
  };
  const sizes = {
    sm: { padding: '5px 10px', fontSize: 12 },
    md: { padding: '8px 14px', fontSize: 13 },
    lg: { padding: '11px 18px', fontSize: 14 },
  };
  const variants = {
    primary: { background: C.accent, color: '#fff', borderColor: C.accent },
    ghost: { background: 'transparent', color: C.ink, borderColor: C.borderStrong },
    danger: { background: 'transparent', color: C.danger, borderColor: '#E5C8CB' },
    quiet: { background: 'transparent', color: C.inkMuted, borderColor: 'transparent' },
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      style={{ ...base, ...sizes[size], ...variants[variant], ...(extra || {}) }}>
      {children}
    </button>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.ink }}>{label}</span>
        {required && <span style={{ fontSize: 11, color: C.danger }}>*</span>}
        {hint && <span style={{ fontSize: 11, color: C.inkSubtle, marginLeft: 4 }}>{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', height: 36, padding: '0 10px', fontSize: 13,
        border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface,
        color: C.ink, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
        transition: 'border-color 0.12s',
      }}
      onFocus={e => e.target.style.borderColor = C.accent}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%', padding: '8px 10px', fontSize: 13, lineHeight: 1.6,
        border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface,
        color: C.ink, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
        resize: 'vertical', transition: 'border-color 0.12s',
      }}
      onFocus={e => e.target.style.borderColor = C.accent}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  );
}

function Pill({ children, tone = 'neutral' }) {
  const tones = {
    neutral: { bg: C.surfaceAlt, fg: C.inkMuted },
    warning: { bg: C.warningLight, fg: C.warning },
    success: { bg: C.successLight, fg: C.success },
    danger: { bg: C.dangerLight, fg: C.danger },
    accent: { bg: C.accentLight, fg: C.accent },
  };
  const t = tones[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 500,
      background: t.bg, color: t.fg,
    }}>
      {children}
    </span>
  );
}

function Hint({ tone = 'info', children }) {
  const tones = {
    info: { bg: C.accentLight, fg: C.accent, Icon: Info },
    warning: { bg: C.warningLight, fg: C.warning, Icon: AlertTriangle },
  };
  const t = tones[tone];
  const Icon = t.Icon;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '10px 12px', borderRadius: 6,
      background: t.bg, color: t.fg, fontSize: 12, lineHeight: 1.55,
    }}>
      <Icon size={14} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>{children}</div>
    </div>
  );
}

// =========================================================================
// GLOBAL STYLES (font + print rules)
// =========================================================================
function GlobalStyles() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch (e) {} };
  }, []);
  return (
    <style>{`
      .fc-app, .fc-app * {
        font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .fc-app input::placeholder, .fc-app textarea::placeholder { color: ${C.inkSubtle}; }
      .fc-app button:not(:disabled):hover { filter: brightness(0.97); }
      .fc-row:hover { background: ${C.surfaceAlt}; }
      .fc-card-hover:hover { border-color: ${C.borderStrong}; }
      .fc-print-only { display: none; }
      @media print {
        @page { size: A4; margin: 18mm 16mm; }
        .fc-app-chrome { display: none !important; }
        .fc-print-only { display: block !important; }
        body { background: white !important; }
        .fc-print-page-break { page-break-before: always; }
      }
    `}</style>
  );
}

// =========================================================================
// DASHBOARD VIEW
// =========================================================================
function Dashboard({ docs, onOpen, onCreate, onDelete }) {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewModal, setShowNewModal] = useState(false);

  const filtered = useMemo(() => {
    return docs.filter(d => {
      if (filter && !d.brandName.toLowerCase().includes(filter.toLowerCase())) return false;
      if (statusFilter !== 'all') {
        const isComplete = progressPct(d) === 100;
        if (statusFilter === 'draft' && isComplete) return false;
        if (statusFilter === 'complete' && !isComplete) return false;
      }
      return true;
    });
  }, [docs, filter, statusFilter]);

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <TopBar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: C.ink, margin: 0, letterSpacing: '-0.01em' }}>
              내 정보공개서
            </h1>
            <p style={{ fontSize: 13, color: C.inkMuted, margin: '4px 0 0' }}>
              영업표지(브랜드)별로 작성·관리합니다.
            </p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <Btn variant="primary" size="lg" onClick={() => setShowNewModal(true)}>
              <Plus size={15} /> 새 정보공개서
            </Btn>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: 11, color: C.inkSubtle }} />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="브랜드명으로 검색"
              style={{
                width: '100%', height: 36, padding: '0 10px 0 32px', fontSize: 13,
                border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface,
                color: C.ink, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              width: 130, height: 36, padding: '0 10px', fontSize: 13,
              border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface,
              color: C.ink, outline: 'none', fontFamily: 'inherit',
            }}
          >
            <option value="all">전체 상태</option>
            <option value="draft">작성 중</option>
            <option value="complete">완료</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState hasDocs={docs.length > 0} onCreate={() => setShowNewModal(true)} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(d => (
              <DocCard key={d.id} doc={d} onOpen={() => onOpen(d.id)} onDelete={() => onDelete(d.id)} />
            ))}
          </div>
        )}
      </div>

      {showNewModal && (
        <NewDocModal
          onClose={() => setShowNewModal(false)}
          onCreate={(brand) => { setShowNewModal(false); onCreate(brand); }}
        />
      )}
    </div>
  );
}

function TopBar() {
  return (
    <div style={{
      borderBottom: `1px solid ${C.border}`, background: C.surface,
      padding: '14px 28px', display: 'flex', alignItems: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 4, background: C.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FileStack size={15} color="#fff" />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, letterSpacing: '-0.01em' }}>
          정보공개서 자동작성
        </div>
        <div style={{ fontSize: 11, color: C.inkSubtle, padding: '2px 7px',
          background: C.surfaceAlt, borderRadius: 999, marginLeft: 4 }}>
          데모
        </div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 18,
        fontSize: 13, color: C.inkMuted }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
          <HelpCircle size={14} /> 도움말
        </span>
        <span style={{ color: C.ink, fontWeight: 500 }}>(주)공정위</span>
      </div>
    </div>
  );
}

function EmptyState({ hasDocs, onCreate }) {
  return (
    <div style={{
      padding: '60px 30px', background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 8, textAlign: 'center',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%', background: C.surfaceAlt,
        margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <FileText size={20} color={C.inkSubtle} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: C.ink, marginBottom: 6 }}>
        {hasDocs ? '검색 결과가 없습니다' : '아직 작성한 정보공개서가 없어요'}
      </div>
      <div style={{ fontSize: 12, color: C.inkMuted, marginBottom: 18 }}>
        {hasDocs ? '다른 검색어를 시도해 보세요.' : '첫 정보공개서 작성을 시작해 보세요.'}
      </div>
      {!hasDocs && (
        <Btn variant="primary" onClick={onCreate}>
          <Plus size={14} /> 새 정보공개서
        </Btn>
      )}
    </div>
  );
}

function DocCard({ doc, onOpen, onDelete }) {
  const pct = progressPct(doc);
  const isComplete = pct === 100;
  return (
    <div className="fc-card-hover" style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
      padding: '16px 18px', transition: 'border-color 0.12s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{doc.brandName}</div>
            {isComplete
              ? <Pill tone="success"><Check size={11} /> 완료</Pill>
              : <Pill tone="warning"><Pencil size={11} /> 작성 중</Pill>}
          </div>
          <div style={{ fontSize: 12, color: C.inkMuted }}>
            {isComplete ? '모든 단계 완료' : `${SECTIONS.length - SECTIONS.filter(s => isStepComplete(doc, s.id)).length}개 단계 남음`}
            <span style={{ margin: '0 8px', color: C.inkSubtle }}>·</span>
            마지막 저장 {relativeTime(doc.lastModified)}
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              flex: 1, maxWidth: 320, height: 4, background: C.surfaceAlt,
              borderRadius: 2, overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: isComplete ? C.success : C.accent,
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ fontSize: 11, color: C.inkMuted, minWidth: 80, textAlign: 'right' }}>
              {SECTIONS.filter(s => isStepComplete(doc, s.id)).length} / 9 단계 ({pct}%)
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <Btn size="sm" variant="quiet" onClick={onDelete}>
            <Trash2 size={13} />
          </Btn>
          <Btn size="md" onClick={onOpen}>
            {isComplete ? '검토하기' : '이어 작성'} <ChevronRight size={13} />
          </Btn>
        </div>
      </div>
    </div>
  );
}

function NewDocModal({ onClose, onCreate }) {
  const [brand, setBrand] = useState('');
  const handleSubmit = () => {
    if (brand.trim()) onCreate(brand.trim());
  };
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(20, 20, 20, 0.42)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.surface, borderRadius: 10, padding: 28, width: '100%', maxWidth: 420,
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
          새 정보공개서 작성
        </div>
        <div style={{ fontSize: 12, color: C.inkMuted, marginBottom: 18, lineHeight: 1.6 }}>
          영업표지(브랜드명)를 먼저 입력해 주세요. 정보공개서는 브랜드별로 작성·등록합니다.
        </div>
        <Field label="영업표지(브랜드명)" required>
          <TextInput value={brand} onChange={setBrand} placeholder="예: 반포삼겹살" />
        </Field>
        <div style={{ display: 'flex', gap: 8, marginTop: 22, justifyContent: 'flex-end' }}>
          <Btn onClick={onClose}>취소</Btn>
          <Btn variant="primary" onClick={handleSubmit} disabled={!brand.trim()}>
            작성 시작
          </Btn>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// WIZARD SHELL
// =========================================================================
function Wizard({ doc, onUpdate, onBack, onReview }) {
  const [savedAt, setSavedAt] = useState(doc.lastModified);
  const [saveTick, setSaveTick] = useState(0);

  // Auto-save: persist whenever doc changes (debounced effect)
  useEffect(() => {
    const t = setTimeout(async () => {
      const ok = await saveDoc(doc);
      if (ok) setSavedAt(new Date().toISOString());
    }, 400);
    return () => clearTimeout(t);
  }, [doc, saveTick]);

  const setStep = (id) => onUpdate({ ...doc, currentStep: id });
  const setData = (patch) => {
    onUpdate({ ...doc, data: { ...doc.data, ...patch } });
    setSaveTick(t => t + 1);
  };

  const currentSection = SECTIONS.find(s => s.id === doc.currentStep) || SECTIONS[0];
  const stepIdx = SECTIONS.findIndex(s => s.id === doc.currentStep);
  const allComplete = SECTIONS.every(s => isStepComplete(doc, s.id));

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        borderBottom: `1px solid ${C.border}`, background: C.surface,
        padding: '12px 22px', display: 'flex', alignItems: 'center',
      }}>
        <Btn variant="quiet" size="sm" onClick={onBack}>
          <ArrowLeft size={14} /> 목록으로
        </Btn>
        <div style={{ marginLeft: 14, fontSize: 13, color: C.ink, fontWeight: 500 }}>
          {doc.brandName}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: C.inkSubtle,
          display: 'flex', alignItems: 'center', gap: 6 }}>
          <CircleCheck size={13} color={C.success} />
          {relativeTime(savedAt)} 자동 저장됨
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex' }}>
        <Sidebar doc={doc} currentStep={doc.currentStep} onSelect={setStep} />
        <div style={{ flex: 1, minWidth: 0, padding: '28px 36px', maxWidth: 880 }}>
          <div style={{ fontSize: 11, color: C.inkSubtle, letterSpacing: '0.04em' }}>
            {stepIdx + 1} / {SECTIONS.length} 단계
          </div>
          <h2 style={{
            fontSize: 20, fontWeight: 600, color: C.ink, margin: '4px 0 0',
            letterSpacing: '-0.01em',
          }}>
            {currentSection.roman}. {currentSection.title}
          </h2>
          <div style={{ height: 1, background: C.border, margin: '20px 0 24px' }} />
          <SectionForm doc={doc} setData={setData} step={doc.currentStep} />
        </div>
      </div>

      <div style={{
        borderTop: `1px solid ${C.border}`, background: C.surface,
        padding: '12px 22px', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Btn onClick={() => stepIdx > 0 && setStep(SECTIONS[stepIdx - 1].id)} disabled={stepIdx === 0}>
          <ArrowLeft size={14} /> 이전
        </Btn>
        <Btn variant="quiet" onClick={onReview}>
          <Eye size={14} /> 미리보기
        </Btn>
        <div style={{ marginLeft: 'auto' }} />
        {stepIdx < SECTIONS.length - 1 ? (
          <Btn variant="primary" onClick={() => setStep(SECTIONS[stepIdx + 1].id)}>
            다음 <ArrowRight size={14} />
          </Btn>
        ) : (
          <Btn variant="primary" onClick={onReview}>
            최종 검토 <ArrowRight size={14} />
          </Btn>
        )}
      </div>
    </div>
  );
}

function Sidebar({ doc, currentStep, onSelect }) {
  return (
    <div style={{
      width: 220, flexShrink: 0, borderRight: `1px solid ${C.border}`,
      background: C.surface, padding: '22px 0',
    }}>
      <div style={{
        fontSize: 11, color: C.inkSubtle, padding: '0 22px 12px',
        letterSpacing: '0.04em',
      }}>
        9개 대분류
      </div>
      {SECTIONS.map(s => {
        const done = isStepComplete(doc, s.id);
        const active = s.id === currentStep;
        return (
          <button key={s.id} onClick={() => onSelect(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: active ? '10px 22px 10px 19px' : '8px 22px',
              fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
              background: active ? C.accentLight : 'transparent',
              borderLeft: active ? `3px solid ${C.accent}` : '3px solid transparent',
              border: 'none', borderRadius: 0, textAlign: 'left',
              color: active ? C.accent : (done ? C.inkMuted : C.inkSubtle),
              fontWeight: active ? 600 : 400,
              transition: 'background 0.12s',
            }}>
            {done ? <CircleCheck size={15} color={C.success} style={{ flexShrink: 0 }} />
              : active ? <Pencil size={15} color={C.accent} style={{ flexShrink: 0 }} />
              : <Circle size={15} style={{ flexShrink: 0 }} />}
            <span>{s.roman}. {s.short}</span>
          </button>
        );
      })}
    </div>
  );
}

function SectionForm({ doc, setData, step }) {
  switch (step) {
    case 1: return <Section1 data={doc.data.s1} update={(s1) => setData({ s1 })} />;
    case 2: return <Section2 data={doc.data.s2} update={(s2) => setData({ s2 })} />;
    case 3: return <Section3 data={doc.data.s3} update={(s3) => setData({ s3 })} />;
    case 4: return <Section4 data={doc.data.s4} update={(s4) => setData({ s4 })} />;
    case 5: return <Section5 data={doc.data.s5} update={(s5) => setData({ s5 })} />;
    case 6: return <Section6 data={doc.data.s6} update={(s6) => setData({ s6 })} />;
    case 7: return <Section7 data={doc.data.s7} update={(s7) => setData({ s7 })} />;
    case 8: return <Section8 data={doc.data.s8} update={(s8) => setData({ s8 })} />;
    case 9: return <Section9 data={doc.data.s9} update={(s9) => setData({ s9 })} />;
    default: return null;
  }
}

// =========================================================================
// SECTION 1 — 일반 현황 (가장 자세히 구현)
// =========================================================================
function Section1({ data, update }) {
  const setCompany = (k, v) => update({ ...data, company: { ...data.company, [k]: v } });
  const setEmployees = (k, v) => update({ ...data, employees: { ...data.employees, [k]: v } });

  const addExec = () => update({ ...data, executives: [...data.executives, { 직위: '', 성명: '', 사업경력: '' }] });
  const setExec = (i, k, v) => {
    const next = [...data.executives];
    next[i] = { ...next[i], [k]: v };
    update({ ...data, executives: next });
  };
  const delExec = (i) => update({ ...data, executives: data.executives.filter((_, j) => j !== i) });

  const addRelated = () => update({ ...data, related: [...data.related, { 관계: '', 명칭: '', 사업: '' }] });
  const setRelated = (i, k, v) => {
    const next = [...data.related];
    next[i] = { ...next[i], [k]: v };
    update({ ...data, related: next });
  };
  const delRelated = (i) => update({ ...data, related: data.related.filter((_, j) => j !== i) });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <SubsectionHeader title="1. 가맹본부의 일반 정보"
        hint="법인 등기부등본·사업자등록증 기재 사항을 그대로 옮겨 적습니다." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="상호" required>
          <TextInput value={data.company.상호} onChange={v => setCompany('상호', v)} placeholder="(주)○○○" />
        </Field>
        <Field label="영업표지(브랜드명)" required>
          <TextInput value={data.company.영업표지} onChange={v => setCompany('영업표지', v)} />
        </Field>
        <Field label="대표자" required>
          <TextInput value={data.company.대표자} onChange={v => setCompany('대표자', v)} />
        </Field>
        <Field label="법인등록번호">
          <TextInput value={data.company.법인등록번호} onChange={v => setCompany('법인등록번호', v)} placeholder="13자리" />
        </Field>
        <Field label="사업자등록번호">
          <TextInput value={data.company.사업자등록번호} onChange={v => setCompany('사업자등록번호', v)} placeholder="000-00-00000" />
        </Field>
        <Field label="홈페이지">
          <TextInput value={data.company.홈페이지} onChange={v => setCompany('홈페이지', v)} placeholder="https://" />
        </Field>
      </div>
      <Field label="본사 주소" required>
        <TextInput value={data.company.주소} onChange={v => setCompany('주소', v)} placeholder="도로명 주소" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="대표 전화">
          <TextInput value={data.company.대표전화} onChange={v => setCompany('대표전화', v)} />
        </Field>
        <Field label="대표 팩스">
          <TextInput value={data.company.대표팩스} onChange={v => setCompany('대표팩스', v)} />
        </Field>
        <Field label="대표 이메일">
          <TextInput value={data.company.이메일} onChange={v => setCompany('이메일', v)} />
        </Field>
        <Field label="가맹사업 담당부서">
          <TextInput value={data.company.담당부서} onChange={v => setCompany('담당부서', v)} placeholder="예: 가맹사업본부" />
        </Field>
      </div>

      <div style={{ height: 1, background: C.border }} />
      <SubsectionHeader title="2. 임원 명단 및 사업경력"
        hint="등기임원 전체와 가맹사업 관련 비등기임원을 모두 기재합니다." />

      <BulkUploadHint label="임원 명단" />

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.surface }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: C.surfaceAlt }}>
              <th style={thStyle('92px')}>직위</th>
              <th style={thStyle('100px')}>성명</th>
              <th style={thStyle()}>주요 사업경력</th>
              <th style={thStyle('36px')}></th>
            </tr>
          </thead>
          <tbody>
            {data.executives.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: C.inkSubtle }}>
                아직 임원이 등록되지 않았습니다.
              </td></tr>
            )}
            {data.executives.map((ex, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={tdStyle()}><CellInput value={ex.직위} onChange={v => setExec(i, '직위', v)} placeholder="대표이사" /></td>
                <td style={tdStyle()}><CellInput value={ex.성명} onChange={v => setExec(i, '성명', v)} /></td>
                <td style={tdStyle()}><CellInput value={ex.사업경력} onChange={v => setExec(i, '사업경력', v)} placeholder="경력 요약" /></td>
                <td style={{ ...tdStyle(), textAlign: 'center' }}>
                  <button onClick={() => delExec(i)} style={iconBtn}>
                    <Trash2 size={13} color={C.inkSubtle} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <Btn size="sm" onClick={addExec}><Plus size={13} /> 임원 추가</Btn>
      </div>

      <div style={{ height: 1, background: C.border }} />
      <SubsectionHeader title="3. 임직원 수"
        hint="바로 전 사업연도 말 기준입니다." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <Field label="사무직">
          <TextInput value={data.employees.사무직} onChange={v => setEmployees('사무직', v)} placeholder="명" />
        </Field>
        <Field label="영업직">
          <TextInput value={data.employees.영업직} onChange={v => setEmployees('영업직', v)} placeholder="명" />
        </Field>
        <Field label="기타">
          <TextInput value={data.employees.기타} onChange={v => setEmployees('기타', v)} placeholder="명" />
        </Field>
      </div>

      <div style={{ height: 1, background: C.border }} />
      <SubsectionHeader title="4. 특수관계인"
        hint="가맹본부와 특수한 이해관계가 있는 자입니다. 없으면 비워 두세요." />
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.surface }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: C.surfaceAlt }}>
              <th style={thStyle('120px')}>관계</th>
              <th style={thStyle()}>명칭(상호 또는 성명)</th>
              <th style={thStyle()}>주된 사업</th>
              <th style={thStyle('36px')}></th>
            </tr>
          </thead>
          <tbody>
            {data.related.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: C.inkSubtle }}>
                해당 사항 없음
              </td></tr>
            )}
            {data.related.map((r, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={tdStyle()}><CellInput value={r.관계} onChange={v => setRelated(i, '관계', v)} /></td>
                <td style={tdStyle()}><CellInput value={r.명칭} onChange={v => setRelated(i, '명칭', v)} /></td>
                <td style={tdStyle()}><CellInput value={r.사업} onChange={v => setRelated(i, '사업', v)} /></td>
                <td style={{ ...tdStyle(), textAlign: 'center' }}>
                  <button onClick={() => delRelated(i)} style={iconBtn}>
                    <Trash2 size={13} color={C.inkSubtle} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <Btn size="sm" onClick={addRelated}><Plus size={13} /> 특수관계인 추가</Btn>
      </div>
    </div>
  );
}

function SubsectionHeader({ title, hint }) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: hint ? 4 : 0 }}>
        {title}
      </div>
      {hint && <div style={{ fontSize: 12, color: C.inkMuted, lineHeight: 1.6 }}>{hint}</div>}
    </div>
  );
}

function BulkUploadHint({ label }) {
  return (
    <div style={{
      border: `1px dashed ${C.borderStrong}`, borderRadius: 8,
      padding: '12px 14px', background: C.surfaceAlt,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 6, background: C.surface,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <Upload size={14} color={C.inkMuted} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: C.ink }}>
          {label}을(를) 엑셀로 한 번에 입력
        </div>
        <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 2 }}>
          템플릿 다운로드 후 채워서 업로드 (데모)
        </div>
      </div>
      <Btn size="sm"><Download size={12} /> 템플릿</Btn>
      <Btn size="sm"><Upload size={12} /> 업로드</Btn>
    </div>
  );
}

function CellInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', height: 30, padding: '0 8px', fontSize: 12,
        border: '1px solid transparent', borderRadius: 4, background: 'transparent',
        color: C.ink, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
      }}
      onFocus={e => { e.target.style.borderColor = C.accent; e.target.style.background = C.surface; }}
      onBlur={e => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent'; }}
    />
  );
}

const thStyle = (w) => ({
  padding: '10px 10px', textAlign: 'left', fontWeight: 500,
  color: C.inkMuted, fontSize: 11, ...(w ? { width: w } : {}),
});
const tdStyle = () => ({ padding: '4px 6px' });
const iconBtn = {
  background: 'transparent', border: 'none', padding: 4, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

// =========================================================================
// SECTION 2 — 가맹사업 현황
// =========================================================================
function Section2({ data, update }) {
  const set = (k, v) => update({ ...data, [k]: v });
  const setStat = (kind, year, v) => update({
    ...data, storeStats: { ...data.storeStats, [kind]: { ...data.storeStats[kind], [year]: v } }
  });
  const setAd = (year, v) => update({ ...data, adSpend: { ...data.adSpend, [year]: v } });
  const addHistory = () => update({ ...data, history: [...data.history, { 연도: '', 내용: '' }] });
  const setHistory = (i, k, v) => {
    const next = [...data.history]; next[i] = { ...next[i], [k]: v };
    update({ ...data, history: next });
  };
  const delHistory = (i) => update({ ...data, history: data.history.filter((_, j) => j !== i) });

  const thisYear = new Date().getFullYear();
  const years = [thisYear - 3, thisYear - 2, thisYear - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <SubsectionHeader title="1. 가맹사업 시작일 및 업종" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="가맹사업 시작일" required>
          <TextInput value={data.startDate} onChange={v => set('startDate', v)} placeholder="YYYY-MM-DD" />
        </Field>
        <Field label="업종" required>
          <TextInput value={data.업종} onChange={v => set('업종', v)} placeholder="예: 외식업 - 한식" />
        </Field>
      </div>

      <div style={{ height: 1, background: C.border }} />
      <SubsectionHeader title="2. 연혁" />
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.surface }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
          <thead><tr style={{ background: C.surfaceAlt }}>
            <th style={thStyle('110px')}>연도</th>
            <th style={thStyle()}>주요 내용</th>
            <th style={thStyle('36px')}></th>
          </tr></thead>
          <tbody>
            {data.history.length === 0 && (
              <tr><td colSpan={3} style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: C.inkSubtle }}>
                연혁이 비어 있습니다.
              </td></tr>
            )}
            {data.history.map((h, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={tdStyle()}><CellInput value={h.연도} onChange={v => setHistory(i, '연도', v)} placeholder="2010" /></td>
                <td style={tdStyle()}><CellInput value={h.내용} onChange={v => setHistory(i, '내용', v)} placeholder="법인 설립" /></td>
                <td style={{ ...tdStyle(), textAlign: 'center' }}>
                  <button onClick={() => delHistory(i)} style={iconBtn}>
                    <Trash2 size={13} color={C.inkSubtle} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div><Btn size="sm" onClick={addHistory}><Plus size={13} /> 연혁 추가</Btn></div>

      <div style={{ height: 1, background: C.border }} />
      <SubsectionHeader title="3. 바로 전 3개 사업연도 가맹점·직영점 수"
        hint="각 사업연도 말 기준입니다." />
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.surface }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: C.surfaceAlt }}>
            <th style={thStyle('100px')}>구분</th>
            <th style={thStyle()}>{years[0]}</th>
            <th style={thStyle()}>{years[1]}</th>
            <th style={thStyle()}>{years[2]}</th>
          </tr></thead>
          <tbody>
            <tr style={{ borderTop: `1px solid ${C.border}` }}>
              <td style={{ ...tdStyle(), padding: '8px 10px', fontWeight: 500, color: C.inkMuted }}>가맹점</td>
              <td style={tdStyle()}><CellInput value={data.storeStats.가맹점.y1} onChange={v => setStat('가맹점', 'y1', v)} placeholder="개" /></td>
              <td style={tdStyle()}><CellInput value={data.storeStats.가맹점.y2} onChange={v => setStat('가맹점', 'y2', v)} placeholder="개" /></td>
              <td style={tdStyle()}><CellInput value={data.storeStats.가맹점.y3} onChange={v => setStat('가맹점', 'y3', v)} placeholder="개" /></td>
            </tr>
            <tr style={{ borderTop: `1px solid ${C.border}` }}>
              <td style={{ ...tdStyle(), padding: '8px 10px', fontWeight: 500, color: C.inkMuted }}>직영점</td>
              <td style={tdStyle()}><CellInput value={data.storeStats.직영점.y1} onChange={v => setStat('직영점', 'y1', v)} placeholder="개" /></td>
              <td style={tdStyle()}><CellInput value={data.storeStats.직영점.y2} onChange={v => setStat('직영점', 'y2', v)} placeholder="개" /></td>
              <td style={tdStyle()}><CellInput value={data.storeStats.직영점.y3} onChange={v => setStat('직영점', 'y3', v)} placeholder="개" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ height: 1, background: C.border }} />
      <SubsectionHeader title="4. 광고·판촉 지출 내역 (3년)" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <Field label={`${years[0]}년`}><TextInput value={data.adSpend.y1} onChange={v => setAd('y1', v)} placeholder="원" /></Field>
        <Field label={`${years[1]}년`}><TextInput value={data.adSpend.y2} onChange={v => setAd('y2', v)} placeholder="원" /></Field>
        <Field label={`${years[2]}년`}><TextInput value={data.adSpend.y3} onChange={v => setAd('y3', v)} placeholder="원" /></Field>
      </div>

      <div style={{ height: 1, background: C.border }} />
      <SubsectionHeader title="5. 가맹금 예치"
        hint="가맹금예치 또는 가맹점사업자피해보상보험 중 하나는 필수입니다." />
      <Field label="가맹금 예치 또는 보험 가입 현황">
        <TextArea value={data.가맹금예치} onChange={v => set('가맹금예치', v)}
          placeholder="예: ○○은행과 가맹금예치계약 체결 (계약일자, 예치한도 등)" />
      </Field>
    </div>
  );
}

// =========================================================================
// SECTION 3 — 법 위반 사실
// =========================================================================
function Section3({ data, update }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <Hint tone="info">
        최근 3개 사업연도에 발생한 사실만 기재합니다. 사실이 없으면 "해당 없음"을 선택하세요.
        선택하지 않은 항목은 기재 누락으로 간주됩니다.
      </Hint>
      <ViolationBlock label="1. 공정거래위원회·시·도지사의 시정조치"
        items={data.시정조치} setItems={v => update({ ...data, 시정조치: v })}
        cols={['처분일자', '처분 내용', '관련 법령']} />
      <div style={{ height: 1, background: C.border }} />
      <ViolationBlock label="2. 민사소송 및 민사상 화해"
        items={data.민사소송} setItems={v => update({ ...data, 민사소송: v })}
        cols={['사건번호', '법원', '결과 및 일자']} />
      <div style={{ height: 1, background: C.border }} />
      <ViolationBlock label="3. 형(刑)의 선고"
        items={data.형사선고} setItems={v => update({ ...data, 형사선고: v })}
        cols={['사건번호', '죄명', '선고 결과']} />
    </div>
  );
}

function ViolationBlock({ label, items, setItems, cols }) {
  const setApplicable = (v) => {
    if (v === false) setItems({ applicable: false, items: [] });
    else setItems({ ...items, applicable: true });
  };
  const add = () => {
    const blank = {}; cols.forEach(c => blank[c] = '');
    setItems({ ...items, applicable: true, items: [...items.items, blank] });
  };
  const setItem = (i, k, v) => {
    const next = [...items.items]; next[i] = { ...next[i], [k]: v };
    setItems({ ...items, items: next });
  };
  const del = (i) => setItems({ ...items, items: items.items.filter((_, j) => j !== i) });

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 10 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <ToggleBtn active={items.applicable === true} onClick={() => setApplicable(true)}>
          해당 사실 있음 {items.items.length > 0 && `(${items.items.length}건)`}
        </ToggleBtn>
        <ToggleBtn active={items.applicable === false} onClick={() => setApplicable(false)}>
          <Check size={12} /> 해당 없음
        </ToggleBtn>
      </div>
      {items.applicable === false && (
        <div style={{ fontSize: 11, color: C.inkMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Info size={12} /> 본문에 "그러한 사실이 없습니다."가 자동 기재됩니다.
        </div>
      )}
      {items.applicable === true && (
        <>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.surface }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
              <thead><tr style={{ background: C.surfaceAlt }}>
                {cols.map(c => <th key={c} style={thStyle()}>{c}</th>)}
                <th style={thStyle('36px')}></th>
              </tr></thead>
              <tbody>
                {items.items.length === 0 && (
                  <tr><td colSpan={cols.length + 1} style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: C.inkSubtle }}>
                    아래 "행 추가"로 사항을 입력해 주세요.
                  </td></tr>
                )}
                {items.items.map((it, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                    {cols.map(c => (
                      <td key={c} style={tdStyle()}>
                        <CellInput value={it[c]} onChange={v => setItem(i, c, v)} />
                      </td>
                    ))}
                    <td style={{ ...tdStyle(), textAlign: 'center' }}>
                      <button onClick={() => del(i)} style={iconBtn}>
                        <Trash2 size={13} color={C.inkSubtle} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 8 }}>
            <Btn size="sm" onClick={add}><Plus size={13} /> 행 추가</Btn>
          </div>
        </>
      )}
    </div>
  );
}

function ToggleBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 14px', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
      border: `1px solid ${active ? C.accent : C.border}`, borderRadius: 6,
      background: active ? C.accentLight : C.surface,
      color: active ? C.accent : C.ink, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      {children}
    </button>
  );
}

// =========================================================================
// SECTIONS 4-9 — simpler forms
// =========================================================================
function MoneyInput({ value, onChange, placeholder }) {
  return <TextInput value={value} onChange={onChange} placeholder={placeholder || '원'} />;
}

function Section4({ data, update }) {
  const setPre = (k, v) => update({ ...data, 영업개시전: { ...data.영업개시전, [k]: v } });
  const setMid = (k, v) => update({ ...data, 영업중: { ...data.영업중, [k]: v } });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <SubsectionHeader title="1. 영업개시 이전 부담"
        hint="가맹점 개점 전까지 가맹점사업자가 부담하는 비용입니다." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="가입비 (가맹비)" required>
          <MoneyInput value={data.영업개시전.가입비} onChange={v => setPre('가입비', v)} />
        </Field>
        <Field label="교육비">
          <MoneyInput value={data.영업개시전.교육비} onChange={v => setPre('교육비', v)} />
        </Field>
        <Field label="계약 이행 보증금">
          <MoneyInput value={data.영업개시전.보증금} onChange={v => setPre('보증금', v)} />
        </Field>
        <Field label="인테리어 비용">
          <MoneyInput value={data.영업개시전.인테리어비} onChange={v => setPre('인테리어비', v)} />
        </Field>
        <Field label="기기·설비 비용">
          <MoneyInput value={data.영업개시전.기기설비비} onChange={v => setPre('기기설비비', v)} />
        </Field>
        <Field label="초도 물품 비용">
          <MoneyInput value={data.영업개시전.초도물품비} onChange={v => setPre('초도물품비', v)} />
        </Field>
      </div>

      <div style={{ height: 1, background: C.border }} />
      <SubsectionHeader title="2. 영업 중 부담"
        hint="가맹점 운영 중 정기적으로 부담하는 비용입니다." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <Field label="로열티">
          <TextInput value={data.영업중.로열티} onChange={v => setMid('로열티', v)} placeholder="예: 매출액의 3%" />
        </Field>
        <Field label="광고 분담금">
          <TextInput value={data.영업중.광고분담금} onChange={v => setMid('광고분담금', v)} />
        </Field>
        <Field label="전산 이용료">
          <TextInput value={data.영업중.전산이용료} onChange={v => setMid('전산이용료', v)} />
        </Field>
      </div>

      <div style={{ height: 1, background: C.border }} />
      <SubsectionHeader title="3. 계약 종료 후 부담"
        hint="없는 경우 그 사실을 기재합니다." />
      <Field label="계약 종료 후 부담">
        <TextArea rows={3} value={data.계약종료후} onChange={v => update({ ...data, 계약종료후: v })}
          placeholder="예: 계약 해지 시 영업표지 사용 중단, 인테리어 원상복구 등" />
      </Field>
    </div>
  );
}

function Section5({ data, update }) {
  const set = (k, v) => update({ ...data, [k]: v });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <Field label="필수구매물품 및 정당한 사유" hint="가맹본부 또는 지정업체로부터 구입해야 하는 물품 및 그 사유">
        <TextArea rows={4} value={data.필수구매물품} onChange={v => set('필수구매물품', v)} />
      </Field>
      <Field label="가맹점사업자의 영업지역 보호" required>
        <TextArea rows={3} value={data.영업지역보호} onChange={v => set('영업지역보호', v)}
          placeholder="예: 점포로부터 반경 ○○m 이내 신규 출점 제한" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="계약 기간" required>
          <TextInput value={data.계약기간} onChange={v => set('계약기간', v)} placeholder="예: 3년" />
        </Field>
        <Field label="계약 갱신 조건">
          <TextInput value={data.갱신조건} onChange={v => set('갱신조건', v)} />
        </Field>
      </div>
      <Field label="계약 해지 조건">
        <TextArea rows={3} value={data.해지조건} onChange={v => set('해지조건', v)} />
      </Field>
    </div>
  );
}

function Section6({ data, update }) {
  const set = (k, v) => update({ ...data, [k]: v });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <Field label="상담·계약·교육·점포공사 등 영업개시까지의 절차" required>
        <TextArea rows={6} value={data.절차} onChange={v => set('절차', v)}
          placeholder="① 상담  ② 가맹계약  ③ 점포 임대차  ④ 인테리어  ⑤ 교육  ⑥ 영업개시" />
      </Field>
      <Field label="총 소요 기간">
        <TextInput value={data.소요기간} onChange={v => set('소요기간', v)} placeholder="예: 약 2~3개월" />
      </Field>
      <Field label="가맹본부와의 분쟁 해결 절차">
        <TextArea rows={3} value={data.분쟁해결} onChange={v => set('분쟁해결', v)}
          placeholder="예: 한국공정거래조정원 가맹사업거래분쟁조정협의회 조정 신청" />
      </Field>
    </div>
  );
}

function Section7({ data, update }) {
  const set = (k, v) => update({ ...data, [k]: v });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <Field label="점포환경개선 시 비용 지원 내역">
        <TextArea rows={3} value={data.점포환경개선} onChange={v => set('점포환경개선', v)} />
      </Field>
      <Field label="판매촉진행사 시 인력 지원 등">
        <TextArea rows={3} value={data.판촉인력지원} onChange={v => set('판촉인력지원', v)} />
      </Field>
      <Field label="경영활동 자문">
        <TextArea rows={3} value={data.자문} onChange={v => set('자문', v)} />
      </Field>
      <Field label="신용 제공 등 내역">
        <TextArea rows={3} value={data.신용제공} onChange={v => set('신용제공', v)} />
      </Field>
    </div>
  );
}

function Section8({ data, update }) {
  const set = (k, v) => update({ ...data, [k]: v });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <Field label="교육·훈련의 주요 내용" required>
        <TextArea rows={4} value={data.교육내용} onChange={v => set('교육내용', v)} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="최소 교육 시간">
          <TextInput value={data.교육시간} onChange={v => set('교육시간', v)} placeholder="예: 80시간" />
        </Field>
        <Field label="교육 비용">
          <MoneyInput value={data.교육비용} onChange={v => set('교육비용', v)} />
        </Field>
      </div>
      <Field label="교육·훈련 불참 시 받을 수 있는 불이익">
        <TextArea rows={3} value={data.불참시불이익} onChange={v => set('불참시불이익', v)} />
      </Field>
    </div>
  );
}

function Section9({ data, update }) {
  const addStore = () => update({ ...data, directStores: [...data.directStores, { 명칭: '', 소재지: '' }] });
  const setStore = (i, k, v) => {
    const next = [...data.directStores]; next[i] = { ...next[i], [k]: v };
    update({ ...data, directStores: next });
  };
  const delStore = (i) => update({ ...data, directStores: data.directStores.filter((_, j) => j !== i) });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <SubsectionHeader title="1. 직영점 명칭 및 소재지"
        hint="바로 전 사업연도 말 기준입니다. 직영점이 없으면 비워 두세요." />
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.surface }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
          <thead><tr style={{ background: C.surfaceAlt }}>
            <th style={thStyle('200px')}>명칭</th>
            <th style={thStyle()}>소재지</th>
            <th style={thStyle('36px')}></th>
          </tr></thead>
          <tbody>
            {data.directStores.length === 0 && (
              <tr><td colSpan={3} style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: C.inkSubtle }}>
                직영점이 등록되지 않았습니다.
              </td></tr>
            )}
            {data.directStores.map((s, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={tdStyle()}><CellInput value={s.명칭} onChange={v => setStore(i, '명칭', v)} /></td>
                <td style={tdStyle()}><CellInput value={s.소재지} onChange={v => setStore(i, '소재지', v)} /></td>
                <td style={{ ...tdStyle(), textAlign: 'center' }}>
                  <button onClick={() => delStore(i)} style={iconBtn}>
                    <Trash2 size={13} color={C.inkSubtle} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div><Btn size="sm" onClick={addStore}><Plus size={13} /> 직영점 추가</Btn></div>

      <div style={{ height: 1, background: C.border }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="전체 직영점 평균 운영 기간">
          <TextInput value={data.평균운영기간} onChange={v => update({ ...data, 평균운영기간: v })} placeholder="예: 4년 2개월" />
        </Field>
        <Field label="전체 직영점 연간 평균 매출액">
          <MoneyInput value={data.평균매출액} onChange={v => update({ ...data, 평균매출액: v })} />
        </Field>
      </div>
    </div>
  );
}

// =========================================================================
// REVIEW VIEW
// =========================================================================
function Review({ doc, onBack, onJumpTo, onPrint }) {
  const completedCount = SECTIONS.filter(s => isStepComplete(doc, s.id)).length;
  const incomplete = SECTIONS.filter(s => !isStepComplete(doc, s.id));
  const allDone = completedCount === SECTIONS.length;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        borderBottom: `1px solid ${C.border}`, background: C.surface,
        padding: '12px 22px', display: 'flex', alignItems: 'center',
      }}>
        <Btn variant="quiet" size="sm" onClick={onBack}>
          <ArrowLeft size={14} /> 위저드로
        </Btn>
        <div style={{ marginLeft: 14, fontSize: 13, color: C.ink, fontWeight: 500 }}>
          {doc.brandName} 정보공개서
        </div>
      </div>

      <div style={{ flex: 1, padding: '32px 28px', maxWidth: 820, margin: '0 auto', width: '100%' }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: C.ink, margin: 0, letterSpacing: '-0.01em' }}>
          최종 검토 & 다운로드
        </h2>
        <p style={{ fontSize: 13, color: C.inkMuted, margin: '6px 0 0' }}>
          모든 단계가 완료되었는지 확인한 뒤 PDF를 다운로드하세요.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 22 }}>
          <StatCard label="완료 단계" value={`${completedCount} / ${SECTIONS.length}`} />
          <StatCard label="총 입력 항목" value={countFields(doc)} />
          <StatCard label="검토 알림"
            value={incomplete.length > 0 ? `${incomplete.length}건` : '없음'}
            tone={incomplete.length > 0 ? 'warning' : 'success'} />
        </div>

        {incomplete.length > 0 && (
          <div style={{
            marginTop: 22, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden',
            background: C.surface,
          }}>
            <div style={{
              padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
              fontSize: 13, fontWeight: 600, color: C.ink, background: C.surfaceAlt,
            }}>
              검토가 필요한 항목
            </div>
            {incomplete.map(s => (
              <div key={s.id} style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <AlertTriangle size={15} color={C.warning} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: C.ink }}>
                    {s.roman}. {s.title}
                  </div>
                  <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 2 }}>
                    필수 입력 항목이 아직 비어 있습니다.
                  </div>
                </div>
                <Btn size="sm" onClick={() => onJumpTo(s.id)}>수정</Btn>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 26 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 10 }}>
            단계별 완료 현황
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {SECTIONS.map(s => {
              const done = isStepComplete(doc, s.id);
              return (
                <div key={s.id} onClick={() => onJumpTo(s.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '9px 12px', borderRadius: 6, fontSize: 12,
                  background: done ? C.surfaceAlt : C.warningLight,
                  color: done ? C.inkMuted : C.warning,
                  cursor: 'pointer', border: `1px solid ${done ? C.border : '#E8D9B8'}`,
                }}>
                  {done
                    ? <CircleCheck size={14} color={C.success} style={{ flexShrink: 0 }} />
                    : <AlertTriangle size={14} style={{ flexShrink: 0 }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.roman}. {s.short}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          marginTop: 24, padding: '14px 16px', background: C.accentLight, borderRadius: 8,
          fontSize: 12, color: C.accent, lineHeight: 1.6,
          display: 'flex', alignItems: 'flex-start', gap: 9,
        }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            본 PDF는 가맹사업법령상 표준양식을 반영한 초안입니다.
            공정거래위원회 등록 전 변호사 또는 가맹거래사의 법적 검토를 받으시기 바랍니다.
          </div>
        </div>

        <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
          <Btn size="lg" style={{ flex: 1 }} onClick={onPrint}>
            <Eye size={14} /> 전체 미리보기
          </Btn>
          <Btn size="lg" variant="primary" style={{ flex: 2 }} onClick={onPrint}>
            <Printer size={14} /> PDF 다운로드 (인쇄 → PDF 저장)
          </Btn>
        </div>

        {!allDone && (
          <div style={{ marginTop: 12, fontSize: 11, color: C.inkSubtle, textAlign: 'center' }}>
            미완료 항목이 있어도 PDF로 출력할 수 있지만, 등록 전 모두 채우는 것을 권장합니다.
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = 'neutral' }) {
  const bg = tone === 'warning' ? C.warningLight : tone === 'success' ? C.successLight : C.surface;
  const fg = tone === 'warning' ? C.warning : tone === 'success' ? C.success : C.ink;
  const border = tone === 'neutral' ? C.border : 'transparent';
  return (
    <div style={{
      background: bg, padding: '14px 16px', borderRadius: 8,
      border: `1px solid ${border}`,
    }}>
      <div style={{ fontSize: 11, color: tone === 'neutral' ? C.inkMuted : fg, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: fg, marginTop: 4, letterSpacing: '-0.01em' }}>
        {value}
      </div>
    </div>
  );
}

function countFields(doc) {
  let n = 0;
  const walk = (v) => {
    if (v === null || v === undefined) return;
    if (typeof v === 'string') { if (v.trim()) n++; return; }
    if (typeof v === 'number') { if (!isNaN(v)) n++; return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === 'object') { Object.values(v).forEach(walk); }
  };
  walk(doc.data);
  return n;
}

// =========================================================================
// PRINT VIEW — 실제 정보공개서 PDF 레이아웃
// =========================================================================
function PrintView({ doc }) {
  const c = doc.data.s1.company;
  const today = new Date();
  return (
    <div className="fc-print-only" style={{
      background: 'white', color: '#111', fontSize: 11, lineHeight: 1.7,
      maxWidth: '210mm', margin: '0 auto',
    }}>
      <PrintCover doc={doc} today={today} />
      <PrintNotice />
      <PrintTOC />
      <PrintSection1 data={doc.data.s1} brand={doc.brandName} />
      <PrintSection2 data={doc.data.s2} brand={doc.brandName} />
      <PrintSection3 data={doc.data.s3} />
      <PrintSection4 data={doc.data.s4} />
      <PrintSection5 data={doc.data.s5} />
      <PrintSection6 data={doc.data.s6} />
      <PrintSection7 data={doc.data.s7} />
      <PrintSection8 data={doc.data.s8} />
      <PrintSection9 data={doc.data.s9} brand={doc.brandName} />
    </div>
  );
}

const printH1 = { fontSize: 22, fontWeight: 700, letterSpacing: '0.4em', textAlign: 'center', margin: '40mm 0 20mm' };
const printH2 = { fontSize: 16, fontWeight: 700, margin: '0 0 16px', borderBottom: '2px solid #111', paddingBottom: 6 };
const printH3 = { fontSize: 13, fontWeight: 600, margin: '20px 0 10px' };
const printSection = { padding: '0 4mm 12mm' };

function PrintCover({ doc, today }) {
  const brand = doc.brandName || '[영업표지]';
  const company = doc.data.s1.company.상호 || '[가맹본부명]';
  return (
    <div style={{ ...printSection, minHeight: '270mm', display: 'flex', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center', fontSize: 12, color: '#444', marginTop: '20mm' }}>
        {brand}
      </div>
      <div style={{ ...printH1 }}>정 보 공 개 서</div>
      <div style={{ textAlign: 'center', fontSize: 12, lineHeight: 2, marginTop: '20mm', maxWidth: '140mm', alignSelf: 'center' }}>
        {company}은(는) 「가맹사업거래의 공정화에 관한 법률」 제7조 및 같은 법 시행령 제4조 제1항에 따라 귀하에게 이 정보공개서를 드립니다.
      </div>
      <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: 12 }}>
        <div style={{ marginBottom: 16 }}>
          {today.getFullYear()}. {String(today.getMonth() + 1).padStart(2, '0')}. {String(today.getDate()).padStart(2, '0')}.
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{company}</div>
      </div>
    </div>
  );
}

function PrintNotice() {
  return (
    <div className="fc-print-page-break" style={printSection}>
      <h2 style={{ ...printH2, textAlign: 'center', borderBottom: 'none', fontSize: 14 }}>＜ 주 의 사 항 ＞</h2>
      <div style={{ fontSize: 11, lineHeight: 2, padding: '0 4mm' }}>
        <p>이 정보공개서는 귀하께서 체결하려는 가맹계약 및 해당 가맹사업에 대한 전반적인 정보를 담고 있으므로 그 내용을 정확하게 파악한 후에 계약체결 여부를 결정하시기 바랍니다.</p>
        <p style={{ marginTop: 14 }}>「가맹사업거래의 공정화에 관한 법률」에 따라 가맹희망자에게는 정보공개서의 내용을 충분히 검토하고 판단할 수 있도록 일정한 기간이 주어집니다. 따라서 이 정보공개서를 제공받은 날부터 14일(변호사나 가맹거래사의 자문을 받은 경우에는 7일)이 지날 때까지는 가맹본부가 귀하로부터 가맹금을 받거나 귀하와 가맹계약을 체결할 수 없습니다.</p>
        <p style={{ marginTop: 14 }}>이 정보공개서는 법령이 정한 기재사항을 담고 있는 것에 불과하며 그 내용의 사실 여부를 공정거래위원회 또는 시·도에서 모두 확인한 것은 아닙니다. 또한, 귀하께서는 어디까지나 가맹계약서의 내용에 따라 가맹사업을 운영하게 되므로 정보공개서의 내용에만 의존하여서는 아니 됩니다.</p>
        <p style={{ marginTop: 14 }}>귀하께서 가맹계약서에 서명하는 순간부터 그 내용에 구속됩니다. 따라서 충분한 시간을 갖고 정보공개서나 가맹계약서의 내용을 검토하시고 기존 가맹점사업자를 방문하여 얻은 정보에 근거하여 가맹본부의 신뢰성을 판단하도록 하십시오.</p>
      </div>
    </div>
  );
}

function PrintTOC() {
  return (
    <div className="fc-print-page-break" style={printSection}>
      <h2 style={{ ...printH2, textAlign: 'center', borderBottom: 'none' }}>목   차</h2>
      <div style={{ maxWidth: '120mm', margin: '0 auto', fontSize: 12, lineHeight: 2.4 }}>
        {SECTIONS.map(s => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #aaa', paddingBottom: 4, marginBottom: 4 }}>
            <span>{s.roman}. {s.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrintRow({ label, value }) {
  return (
    <tr style={{ borderTop: '1px solid #ccc' }}>
      <td style={{ padding: '7px 10px', background: '#F4F1EA', fontWeight: 600, width: '32%', verticalAlign: 'top' }}>{label}</td>
      <td style={{ padding: '7px 10px', verticalAlign: 'top' }}>{value || <span style={{ color: '#999' }}>—</span>}</td>
    </tr>
  );
}

function PrintTable({ headers, rows }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc', fontSize: 11, marginTop: 8 }}>
      <thead>
        <tr style={{ background: '#F4F1EA' }}>
          {headers.map((h, i) => (
            <th key={i} style={{ padding: '8px 10px', borderBottom: '1px solid #ccc', borderRight: i < headers.length-1 ? '1px solid #ccc' : 'none', textAlign: 'left', fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={headers.length} style={{ padding: '14px', textAlign: 'center', color: '#888' }}>해당 사항 없음</td></tr>
        ) : rows.map((r, i) => (
          <tr key={i} style={{ borderTop: '1px solid #ccc' }}>
            {r.map((cell, j) => (
              <td key={j} style={{ padding: '7px 10px', borderRight: j < r.length-1 ? '1px solid #ccc' : 'none', verticalAlign: 'top' }}>{cell || <span style={{ color: '#bbb' }}>—</span>}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PrintSection1({ data, brand }) {
  const c = data.company;
  return (
    <div className="fc-print-page-break" style={printSection}>
      <h2 style={printH2}>Ⅰ. 가맹본부의 일반 현황</h2>
      <h3 style={printH3}>1. 가맹본부의 일반 정보</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc', fontSize: 11 }}>
        <tbody>
          <PrintRow label="상호" value={c.상호} />
          <PrintRow label="영업표지" value={c.영업표지 || brand} />
          <PrintRow label="대표자" value={c.대표자} />
          <PrintRow label="주소" value={c.주소} />
          <PrintRow label="법인등록번호" value={c.법인등록번호} />
          <PrintRow label="사업자등록번호" value={c.사업자등록번호} />
          <PrintRow label="홈페이지" value={c.홈페이지} />
          <PrintRow label="대표 이메일" value={c.이메일} />
          <PrintRow label="대표 전화 / 팩스" value={[c.대표전화, c.대표팩스].filter(Boolean).join(' / ')} />
          <PrintRow label="가맹사업 담당부서" value={[c.담당부서, c.담당전화].filter(Boolean).join(' · ')} />
        </tbody>
      </table>

      <h3 style={printH3}>2. 임원 명단 및 사업경력</h3>
      <PrintTable
        headers={['직위', '성명', '주요 사업경력']}
        rows={data.executives.map(e => [e.직위, e.성명, e.사업경력])}
      />

      <h3 style={printH3}>3. 임직원 수</h3>
      <PrintTable
        headers={['사무직', '영업직', '기타']}
        rows={[[
          data.employees.사무직 ? `${data.employees.사무직}명` : '',
          data.employees.영업직 ? `${data.employees.영업직}명` : '',
          data.employees.기타 ? `${data.employees.기타}명` : '',
        ]]}
      />

      <h3 style={printH3}>4. 특수관계인</h3>
      <PrintTable
        headers={['관계', '명칭(상호 또는 성명)', '주된 사업']}
        rows={data.related.map(r => [r.관계, r.명칭, r.사업])}
      />
    </div>
  );
}

function PrintSection2({ data, brand }) {
  const yr = new Date().getFullYear();
  const years = [yr-3, yr-2, yr-1];
  return (
    <div className="fc-print-page-break" style={printSection}>
      <h2 style={printH2}>Ⅱ. 가맹본부의 가맹사업 현황</h2>
      <h3 style={printH3}>1. [{brand}] 시작일 및 업종</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc', fontSize: 11 }}>
        <tbody>
          <PrintRow label="가맹사업 시작일" value={data.startDate} />
          <PrintRow label="업종" value={data.업종} />
        </tbody>
      </table>

      <h3 style={printH3}>2. 연혁</h3>
      <PrintTable
        headers={['연도', '주요 내용']}
        rows={data.history.map(h => [h.연도, h.내용])}
      />

      <h3 style={printH3}>3. 바로 전 3개 사업연도 가맹점·직영점 수</h3>
      <PrintTable
        headers={['구분', `${years[0]}년 말`, `${years[1]}년 말`, `${years[2]}년 말`]}
        rows={[
          ['가맹점', data.storeStats.가맹점.y1, data.storeStats.가맹점.y2, data.storeStats.가맹점.y3],
          ['직영점', data.storeStats.직영점.y1, data.storeStats.직영점.y2, data.storeStats.직영점.y3],
        ]}
      />

      <h3 style={printH3}>4. 광고·판촉 지출 내역</h3>
      <PrintTable
        headers={[`${years[0]}년`, `${years[1]}년`, `${years[2]}년`]}
        rows={[[data.adSpend.y1, data.adSpend.y2, data.adSpend.y3]]}
      />

      <h3 style={printH3}>5. 가맹금 예치</h3>
      <p style={{ fontSize: 11, lineHeight: 1.8, padding: '0 4mm' }}>
        {data.가맹금예치 || <span style={{ color: '#999' }}>해당없음</span>}
      </p>
    </div>
  );
}

function PrintSection3({ data }) {
  const renderBlock = (label, info, headers) => (
    <>
      <h3 style={printH3}>{label}</h3>
      {info.applicable === false ? (
        <p style={{ fontSize: 11, padding: '0 4mm' }}>그러한 사실이 없습니다.</p>
      ) : info.applicable === true ? (
        <PrintTable headers={headers} rows={info.items.map(it => headers.map(h => it[h]))} />
      ) : (
        <p style={{ fontSize: 11, padding: '0 4mm', color: '#999' }}>(미작성)</p>
      )}
    </>
  );
  return (
    <div className="fc-print-page-break" style={printSection}>
      <h2 style={printH2}>Ⅲ. 가맹본부와 그 임원의 법 위반 사실</h2>
      {renderBlock('1. 공정거래위원회·시·도지사의 시정조치', data.시정조치, ['처분일자', '처분 내용', '관련 법령'])}
      {renderBlock('2. 민사소송 및 민사상 화해', data.민사소송, ['사건번호', '법원', '결과 및 일자'])}
      {renderBlock('3. 형(刑)의 선고', data.형사선고, ['사건번호', '죄명', '선고 결과'])}
    </div>
  );
}

function PrintSection4({ data }) {
  const fmt = (v) => v ? `${Number(v).toLocaleString()}원` : '';
  const pre = data.영업개시전;
  const mid = data.영업중;
  return (
    <div className="fc-print-page-break" style={printSection}>
      <h2 style={printH2}>Ⅳ. 가맹점사업자의 부담</h2>
      <h3 style={printH3}>1. 영업개시 이전의 부담</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc', fontSize: 11 }}>
        <tbody>
          <PrintRow label="가입비 (가맹비)" value={fmt(pre.가입비)} />
          <PrintRow label="교육비" value={fmt(pre.교육비)} />
          <PrintRow label="계약 이행 보증금" value={fmt(pre.보증금)} />
          <PrintRow label="인테리어 비용" value={fmt(pre.인테리어비)} />
          <PrintRow label="기기·설비 비용" value={fmt(pre.기기설비비)} />
          <PrintRow label="초도 물품 비용" value={fmt(pre.초도물품비)} />
        </tbody>
      </table>
      <h3 style={printH3}>2. 영업 중의 부담</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc', fontSize: 11 }}>
        <tbody>
          <PrintRow label="로열티" value={mid.로열티} />
          <PrintRow label="광고 분담금" value={mid.광고분담금} />
          <PrintRow label="전산 이용료" value={mid.전산이용료} />
        </tbody>
      </table>
      <h3 style={printH3}>3. 계약 종료 후의 부담</h3>
      <p style={{ fontSize: 11, lineHeight: 1.8, padding: '0 4mm', whiteSpace: 'pre-wrap' }}>
        {data.계약종료후 || <span style={{ color: '#999' }}>그러한 사실이 없습니다.</span>}
      </p>
    </div>
  );
}

function ParaBlock({ title, value }) {
  return (
    <>
      <h3 style={printH3}>{title}</h3>
      <p style={{ fontSize: 11, lineHeight: 1.8, padding: '0 4mm', whiteSpace: 'pre-wrap' }}>
        {value || <span style={{ color: '#999' }}>해당없음</span>}
      </p>
    </>
  );
}

function PrintSection5({ data }) {
  return (
    <div className="fc-print-page-break" style={printSection}>
      <h2 style={printH2}>Ⅴ. 영업활동에 대한 조건 및 제한</h2>
      <ParaBlock title="1. 필수구매물품 및 정당한 사유" value={data.필수구매물품} />
      <ParaBlock title="2. 가맹점사업자의 영업지역 보호" value={data.영업지역보호} />
      <ParaBlock title="3. 계약 기간" value={data.계약기간} />
      <ParaBlock title="4. 계약 갱신 조건" value={data.갱신조건} />
      <ParaBlock title="5. 계약 해지 조건" value={data.해지조건} />
    </div>
  );
}

function PrintSection6({ data }) {
  return (
    <div className="fc-print-page-break" style={printSection}>
      <h2 style={printH2}>Ⅵ. 가맹사업의 영업 개시에 관한 상세한 절차와 소요기간</h2>
      <ParaBlock title="1. 영업개시까지의 절차" value={data.절차} />
      <ParaBlock title="2. 총 소요 기간" value={data.소요기간} />
      <ParaBlock title="3. 가맹본부와의 분쟁 해결 절차" value={data.분쟁해결} />
    </div>
  );
}

function PrintSection7({ data }) {
  return (
    <div className="fc-print-page-break" style={printSection}>
      <h2 style={printH2}>Ⅶ. 가맹본부의 경영 및 영업활동 등에 대한 지원</h2>
      <ParaBlock title="1. 점포환경개선 시 비용 지원" value={data.점포환경개선} />
      <ParaBlock title="2. 판매촉진행사 시 인력 지원" value={data.판촉인력지원} />
      <ParaBlock title="3. 경영활동 자문" value={data.자문} />
      <ParaBlock title="4. 신용 제공 등" value={data.신용제공} />
    </div>
  );
}

function PrintSection8({ data }) {
  const fmt = (v) => v ? `${Number(v).toLocaleString()}원` : '해당없음';
  return (
    <div className="fc-print-page-break" style={printSection}>
      <h2 style={printH2}>Ⅷ. 교육·훈련에 대한 설명</h2>
      <ParaBlock title="1. 교육·훈련의 주요 내용" value={data.교육내용} />
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc', fontSize: 11, marginTop: 8 }}>
        <tbody>
          <PrintRow label="2. 최소 교육 시간" value={data.교육시간} />
          <PrintRow label="3. 교육 비용" value={data.교육비용 ? fmt(data.교육비용) : ''} />
        </tbody>
      </table>
      <ParaBlock title="4. 교육·훈련 불참 시 받을 수 있는 불이익" value={data.불참시불이익} />
    </div>
  );
}

function PrintSection9({ data, brand }) {
  return (
    <div className="fc-print-page-break" style={printSection}>
      <h2 style={printH2}>Ⅸ. 가맹본부의 직영점 현황</h2>
      <h3 style={printH3}>1. 직영점 명칭 및 소재지</h3>
      <PrintTable
        headers={['명칭', '소재지']}
        rows={data.directStores.map(s => [s.명칭, s.소재지])}
      />
      <h3 style={printH3}>2. 전체 직영점 평균 운영 기간 및 매출액</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc', fontSize: 11 }}>
        <tbody>
          <PrintRow label="평균 운영 기간" value={data.평균운영기간} />
          <PrintRow label="연간 평균 매출액" value={data.평균매출액 ? `${Number(data.평균매출액).toLocaleString()}원` : ''} />
        </tbody>
      </table>
      <div style={{ marginTop: '20mm', textAlign: 'center', fontSize: 10, color: '#666' }}>
        — {brand} 정보공개서 끝 —
      </div>
    </div>
  );
}

// =========================================================================
// MAIN APP — 라우터 + 상태 오케스트레이션
// =========================================================================
export default function App() {
  const [docs, setDocs] = useState(null);
  const [view, setView] = useState({ name: 'dashboard' });
  const [activeDoc, setActiveDoc] = useState(null);

  // Initial load from window.storage
  useEffect(() => {
    (async () => {
      const loaded = await loadAllDocs();
      setDocs(loaded);
    })();
  }, []);

  const handleCreate = useCallback(async (brand) => {
    const doc = emptyDoc(brand);
    await saveDoc(doc);
    setDocs(prev => [doc, ...(prev || [])]);
    setActiveDoc(doc);
    setView({ name: 'wizard' });
  }, []);

  const handleOpen = useCallback(async (id) => {
    const d = (docs || []).find(x => x.id === id);
    if (d) {
      setActiveDoc(d);
      setView({ name: 'wizard' });
    }
  }, [docs]);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('이 정보공개서를 삭제할까요? 입력한 내용이 모두 사라집니다.')) return;
    await deleteDocStorage(id);
    setDocs(prev => prev.filter(d => d.id !== id));
  }, []);

  const handleUpdate = useCallback((next) => {
    setActiveDoc(next);
    setDocs(prev => {
      if (!prev) return prev;
      const idx = prev.findIndex(d => d.id === next.id);
      if (idx < 0) return [next, ...prev];
      const out = [...prev];
      out[idx] = next;
      return out;
    });
  }, []);

  const handleBackToDashboard = useCallback(() => {
    setView({ name: 'dashboard' });
    setActiveDoc(null);
  }, []);

  const handleReview = useCallback(() => {
    setView({ name: 'review' });
  }, []);

  const handleJumpToStep = useCallback((stepId) => {
    setActiveDoc(prev => prev ? { ...prev, currentStep: stepId } : prev);
    setView({ name: 'wizard' });
  }, []);

  const handlePrint = useCallback(() => {
    // Trigger browser print → user picks "Save as PDF"
    setTimeout(() => { try { window.print(); } catch (e) {} }, 100);
  }, []);

  // Loading state
  if (docs === null) {
    return (
      <div className="fc-app" style={{ minHeight: '100vh', background: C.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <GlobalStyles />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.inkMuted }}>
          <Loader2 size={16} className="fc-spin" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13 }}>저장된 문서를 불러오는 중…</span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="fc-app">
      <GlobalStyles />
      <div className="fc-app-chrome">
        {view.name === 'dashboard' && (
          <Dashboard
            docs={docs}
            onOpen={handleOpen}
            onCreate={handleCreate}
            onDelete={handleDelete}
          />
        )}
        {view.name === 'wizard' && activeDoc && (
          <Wizard
            doc={activeDoc}
            onUpdate={handleUpdate}
            onBack={handleBackToDashboard}
            onReview={handleReview}
          />
        )}
        {view.name === 'review' && activeDoc && (
          <Review
            doc={activeDoc}
            onBack={() => setView({ name: 'wizard' })}
            onJumpTo={handleJumpToStep}
            onPrint={handlePrint}
          />
        )}
      </div>
      {/* Always-rendered print template (hidden on screen, shown only when window.print is invoked) */}
      {activeDoc && <PrintView doc={activeDoc} />}
    </div>
  );
}

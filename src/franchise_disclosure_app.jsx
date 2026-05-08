import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FileStack, Plus, Download, Copy, Eye, ArrowLeft, ArrowRight,
  CircleCheck, Circle, Pencil, AlertTriangle, Info, Trash2, Upload,
  HelpCircle, X, Search, Printer, Building2, Calendar, Users,
  Briefcase, Scale, Wallet, ShieldCheck, GraduationCap, Store,
  ChevronRight, FileText, Check, Hash, Loader2,
} from 'lucide-react';

// =========================================================================
// LOCALSTORAGE 호환 레이어 (Vercel 배포용 — window.storage 대체)
// =========================================================================
const _storage = {
  async set(key, value, _shared) {
    try { localStorage.setItem(key, value); return { key, value }; } catch (e) { return null; }
  },
  async get(key, _shared) {
    const value = localStorage.getItem(key);
    if (value === null) throw new Error('not found');
    return { key, value };
  },
  async delete(key, _shared) {
    localStorage.removeItem(key); return { key, deleted: true };
  },
  async list(prefix = '', _shared) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    return { keys };
  }
};

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
    pwHash: '',
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
    const result = await _storage.list('doc:');
    if (!result || !result.keys || result.keys.length === 0) return [];
    const out = [];
    for (const k of result.keys) {
      try {
        const r = await _storage.get(k);
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
    await _storage.set(`doc:${doc.id}`, JSON.stringify(doc));
    return true;
  } catch (e) { return false; }
}

async function deleteDocStorage(id) {
  try { await _storage.delete(`doc:${id}`); return true; } catch (e) { return false; }
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
function Dashboard({ docs, onOpen, onCreate, onDelete, onAdmin, lawyerProfile, isAdmin }) {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [unlocking, setUnlocking] = useState(null); // doc being unlocked

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
      <TopBar onAdmin={onAdmin} lawyerProfile={lawyerProfile} />
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
              <DocCard key={d.id} doc={d}
                onOpen={() => setUnlocking(d)}
                onDelete={() => onDelete(d.id)}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </div>

      {unlocking && (
        <DocPasswordModal
          doc={unlocking}
          isAdmin={isAdmin}
          onSuccess={() => { onOpen(unlocking.id); setUnlocking(null); }}
          onClose={() => setUnlocking(null)}
        />
      )}

      {showNewModal && (
        <NewDocModal
          onClose={() => setShowNewModal(false)}
          onCreate={(brand, pwHash) => { setShowNewModal(false); onCreate(brand, pwHash); }}
        />
      )}
      <SiteFooter lawyerProfile={lawyerProfile} />
    </div>
  );
}

function DocPasswordModal({ doc, isAdmin, onSuccess, onClose }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');

  const simpleHash = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return String(h);
  };

  const handleSubmit = () => {
    if (isAdmin) { onSuccess(); return; } // 관리자는 비밀번호 없이 접근 가능
    if (!doc.pwHash || simpleHash(pw) === doc.pwHash) {
      onSuccess();
    } else {
      setError('비밀번호가 맞지 않습니다.');
      setPw('');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,15,15,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 20,
    }}>
      <div style={{
        background: C.surface, borderRadius: 12, padding: 28, width: '100%', maxWidth: 380,
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', background: C.accentLight,
            margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{doc.brandName}</div>
          <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 4 }}>
            {isAdmin ? '관리자 권한으로 접근합니다.' : '이 문서에 접근하려면 비밀번호가 필요합니다.'}
          </div>
        </div>
        {isAdmin ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={onClose} style={{ flex: 1 }}>취소</Btn>
            <Btn variant="primary" onClick={handleSubmit} style={{ flex: 2 }}>
              관리자 권한으로 열기
            </Btn>
          </div>
        ) : (
          <>
            <Field label="문서 비밀번호">
              <input
                type="password"
                value={pw}
                onChange={e => { setPw(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoFocus
                style={{
                  width: '100%', height: 38, padding: '0 10px', fontSize: 14,
                  border: `1px solid ${error ? C.danger : C.border}`,
                  borderRadius: 6, background: C.surface, color: C.ink,
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </Field>
            {error && (
              <div style={{ fontSize: 12, color: C.danger, marginTop: 6,
                display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertTriangle size={12} /> {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <Btn onClick={onClose} style={{ flex: 1 }}>취소</Btn>
              <Btn variant="primary" onClick={handleSubmit} disabled={!pw} style={{ flex: 2 }}>
                열기
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TopBar({ onAdmin, lawyerProfile }) {
  const lp = lawyerProfile;
  return (
    <div style={{
      borderBottom: `1px solid ${C.border}`, background: C.surface,
      padding: '12px 28px', display: 'flex', alignItems: 'center',
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
      </div>
      {lp && lp.name && (
        <div style={{
          marginLeft: 20, padding: '4px 12px', background: C.accentLight,
          borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent }} />
          <span style={{ fontSize: 12, color: C.accent, fontWeight: 500 }}>
            {lp.name} 변호사 {lp.firm ? `| ${lp.firm}` : ''} 법률 서비스
          </span>
        </div>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12,
        fontSize: 13, color: C.inkMuted }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
          <HelpCircle size={14} /> 도움말
        </span>
        <button onClick={onAdmin} title="관리자 설정" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 30, height: 30, borderRadius: 6, border: `1px solid ${C.border}`,
          background: C.surface, cursor: 'pointer', color: C.inkSubtle,
          transition: 'all 0.12s',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </button>
      </div>
    </div>
  );
}

function SiteFooter({ lawyerProfile: lp }) {
  if (!lp || !lp.name) return null;
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, background: C.surface, padding: '32px 28px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 40, flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{lp.name}</span>
              <span style={{ fontSize: 13, color: C.inkMuted }}>변호사</span>
              {lp.barNumber && <span style={{ fontSize: 11, color: C.inkSubtle }}>제{lp.barNumber}호</span>}
            </div>
            {lp.firm && <div style={{ fontSize: 13, fontWeight: 500, color: C.accent, marginBottom: 2 }}>{lp.firm}</div>}
            {lp.tagline && <div style={{ fontSize: 12, color: C.inkSubtle, marginTop: 4, fontStyle: 'italic' }}>{lp.tagline}</div>}
          </div>
          {(lp.firmAddress || lp.phone || lp.email || lp.website) && (
            <div style={{ width: 1, background: C.border, alignSelf: 'stretch', minHeight: 40 }} />
          )}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: '8px 32px' }}>
            {lp.firmAddress && <ContactItem label="주소" value={lp.firmAddress} />}
            {lp.phone && <ContactItem label="전화" value={lp.phone} link={`tel:${lp.phone}`} />}
            {lp.email && <ContactItem label="이메일" value={lp.email} link={`mailto:${lp.email}`} />}
            {lp.website && <ContactItem label="홈페이지" value={lp.website} link={lp.website} />}
          </div>
        </div>
        <div style={{
          marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ fontSize: 11, color: C.inkSubtle, lineHeight: 1.6 }}>
            본 서비스는 「가맹사업거래의 공정화에 관한 법률」에 따른 정보공개서 표준양식 작성을 지원합니다.
            공정거래위원회 등록 전 최종 법률 검토가 권장됩니다.
          </div>
          <div style={{ fontSize: 11, color: C.inkSubtle }}>
            © {new Date().getFullYear()} {lp.firm || lp.name}
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactItem({ label, value, link }) {
  const inner = (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <span style={{ fontSize: 10, color: C.inkSubtle, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 12, color: C.ink, marginTop: 2 }}>{value}</span>
    </div>
  );
  if (link) return (
    <a href={link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>{inner}</a>
  );
  return inner;
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

function DocCard({ doc, onOpen, onDelete, isAdmin }) {
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
          {isAdmin && (
            <Btn size="sm" variant="quiet" onClick={onDelete} style={{ color: C.danger }}>
              <Trash2 size={13} />
            </Btn>
          )}
          <Btn size="md" onClick={onOpen}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <rect x="3" y="11" width="18" height="11" rx="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            {isComplete ? '검토하기' : '이어 작성'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function NewDocModal({ onClose, onCreate }) {
  const [brand, setBrand] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');

  const simpleHash = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return String(h);
  };

  const handleSubmit = () => {
    if (!brand.trim()) return;
    if (pw.length < 4) { setError('비밀번호는 4자 이상이어야 합니다.'); return; }
    if (pw !== pw2) { setError('비밀번호가 일치하지 않습니다.'); return; }
    onCreate(brand.trim(), simpleHash(pw));
  };

  const canSubmit = brand.trim() && pw.length >= 4 && pw === pw2;

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
          브랜드명과 문서 비밀번호를 설정합니다. 비밀번호는 이 문서를 열거나 수정할 때 필요합니다.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="영업표지(브랜드명)" required>
            <TextInput value={brand} onChange={setBrand} placeholder="예: 반포삼겹살" />
          </Field>
          <Field label="문서 비밀번호" required hint="4자 이상, 잊어버리면 찾을 수 없습니다">
            <input
              type="password"
              value={pw}
              onChange={e => { setPw(e.target.value); setError(''); }}
              placeholder="비밀번호 입력"
              style={{
                width: '100%', height: 36, padding: '0 10px', fontSize: 13,
                border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface,
                color: C.ink, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </Field>
          <Field label="비밀번호 확인" required>
            <input
              type="password"
              value={pw2}
              onChange={e => { setPw2(e.target.value); setError(''); }}
              placeholder="비밀번호 재입력"
              style={{
                width: '100%', height: 36, padding: '0 10px', fontSize: 13,
                border: `1px solid ${pw2 && pw !== pw2 ? C.danger : C.border}`,
                borderRadius: 6, background: C.surface,
                color: C.ink, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </Field>
        </div>
        {error && (
          <div style={{ fontSize: 12, color: C.danger, marginTop: 8,
            display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertTriangle size={12} /> {error}
          </div>
        )}
        <Hint tone="warning" style={{ marginTop: 14 }}>
          비밀번호를 잊어버리면 문서에 다시 접근할 수 없습니다. 안전한 곳에 메모해 두세요.
        </Hint>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <Btn onClick={onClose}>취소</Btn>
          <Btn variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
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
function Wizard({ doc, onUpdate, onBack, onReview, templateConfig, lawyerProfile, onAdmin }) {
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
          {templateConfig && templateConfig[`s${doc.currentStep}`] && templateConfig[`s${doc.currentStep}`].notice && (
            <div style={{ marginBottom: 20 }}>
              <Hint tone="warning">
                <strong>법령 변경 주의</strong> — {templateConfig[`s${doc.currentStep}`].notice}
              </Hint>
            </div>
          )}
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
// PRINT — LAWYER BRANDING PAGE
// =========================================================================
function PrintLawyerPage({ lawyerProfile: lp }) {
  return (
    <div className="fc-print-page-break" style={{
      ...printSection, minHeight: '180mm', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    }}>
      <div style={{
        border: '2px solid #1B3A5C', borderRadius: 8, padding: '40px 50px',
        maxWidth: '140mm', width: '100%',
      }}>
        <div style={{ fontSize: 10, color: '#888', letterSpacing: '0.15em', marginBottom: 20 }}>
          이 정보공개서는 법률 자문 하에 작성되었습니다
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1B3A5C', letterSpacing: '-0.01em', marginBottom: 4 }}>
          {lp.name}
        </div>
        <div style={{ fontSize: 13, color: '#444', marginBottom: 2 }}>변호사</div>
        {lp.barNumber && (
          <div style={{ fontSize: 11, color: '#888', marginBottom: 16 }}>
            변호사 등록번호 제{lp.barNumber}호
          </div>
        )}
        {lp.firm && (
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 6 }}>
            {lp.firm}
          </div>
        )}
        {lp.firmAddress && (
          <div style={{ fontSize: 11, color: '#666', marginBottom: 12 }}>{lp.firmAddress}</div>
        )}
        <div style={{ height: 1, background: '#ddd', margin: '16px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, fontSize: 11, color: '#555' }}>
          {lp.phone && <span>T. {lp.phone}</span>}
          {lp.email && <span>E. {lp.email}</span>}
          {lp.website && <span>W. {lp.website}</span>}
        </div>
        {lp.tagline && (
          <div style={{ marginTop: 20, fontSize: 12, color: '#666', fontStyle: 'italic', lineHeight: 1.6 }}>
            "{lp.tagline}"
          </div>
        )}
      </div>
      <div style={{ marginTop: 24, fontSize: 10, color: '#aaa', maxWidth: '140mm', lineHeight: 1.7 }}>
        본 정보공개서는 가맹사업거래의 공정화에 관한 법률에 따른 표준양식을 기반으로 법률 자문을 받아 작성되었습니다. 공정거래위원회 등록 전 최종 검토가 필요합니다.
      </div>
    </div>
  );
}

// =========================================================================
// ANNOUNCEMENT POPUP
// =========================================================================
function AnnouncementPopup({ announcements, onDismissAll }) {
  const [idx, setIdx] = useState(0);
  if (!announcements || announcements.length === 0) return null;
  const ann = announcements[idx];
  const isLast = idx === announcements.length - 1;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 15, 15, 0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 20,
    }}>
      <div style={{
        background: C.surface, borderRadius: 12, width: '100%', maxWidth: 480,
        border: `1px solid ${C.border}`, overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        <div style={{
          padding: '16px 20px', background: C.warningLight,
          borderBottom: `1px solid #E8D9B8`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertTriangle size={17} color={C.warning} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.warning }}>
              법령 변경 공지 {announcements.length > 1 ? `(${idx + 1}/${announcements.length})` : ''}
            </div>
            <div style={{ fontSize: 11, color: C.warning, opacity: 0.8 }}>
              아래 내용을 확인하고 정보공개서 작성 시 반영하세요.
            </div>
          </div>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 8 }}>
            {ann.title}
          </div>
          {ann.effectiveDate && (
            <div style={{ fontSize: 11, color: C.inkSubtle, marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 5 }}>
              <Calendar size={12} /> 시행일: {ann.effectiveDate}
            </div>
          )}
          <div style={{
            fontSize: 13, color: C.inkMuted, lineHeight: 1.75,
            padding: '14px', background: C.surfaceAlt, borderRadius: 6,
            maxHeight: 200, overflowY: 'auto',
          }}>
            {ann.content}
          </div>
          {ann.affectedSections && ann.affectedSections.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: C.inkSubtle }}>영향 단계:</span>
              {ann.affectedSections.map(s => (
                <Pill key={s} tone="warning">{s}</Pill>
              ))}
            </div>
          )}
        </div>
        <div style={{
          padding: '12px 24px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          {!isLast ? (
            <>
              <Btn onClick={onDismissAll}>모두 건너뛰기</Btn>
              <Btn variant="primary" onClick={() => setIdx(i => i + 1)}>
                다음 공지 <ArrowRight size={13} />
              </Btn>
            </>
          ) : (
            <Btn variant="primary" onClick={onDismissAll}>
              <Check size={13} /> 확인했습니다
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// ADMIN PANEL
// =========================================================================
function AdminGate({ onEnter, onClose }) {
  const [pw, setPw] = useState('');
  const [mode, setMode] = useState('check'); // 'check' | 'set'
  const [storedHash, setStoredHash] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await _storage.get('admin_pw_hash', true);
        if (r) { setStoredHash(r.value); setMode('check'); }
        else setMode('set');
      } catch (e) { setMode('set'); }
    })();
  }, []);

  const simpleHash = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return String(h);
  };

  const handleSubmit = async () => {
    if (mode === 'set') {
      if (pw.length < 4) { setError('4자 이상 입력하세요.'); return; }
      await _storage.set('admin_pw_hash', simpleHash(pw), true);
      onEnter();
    } else {
      if (simpleHash(pw) === storedHash) { onEnter(); }
      else { setError('비밀번호가 맞지 않습니다.'); setPw(''); }
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,15,15,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 20,
    }}>
      <div style={{
        background: C.surface, borderRadius: 12, padding: 30, width: '100%', maxWidth: 360,
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', background: C.accentLight,
            margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>관리자 로그인</div>
          <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 4 }}>
            {mode === 'set' ? '처음 사용 시 관리자 비밀번호를 설정합니다.' : '변호사 관리자 전용 영역입니다.'}
          </div>
        </div>
        <Field label={mode === 'set' ? '새 비밀번호 설정' : '비밀번호'}>
          <input
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoFocus
            style={{
              width: '100%', height: 38, padding: '0 10px', fontSize: 14,
              border: `1px solid ${error ? C.danger : C.border}`, borderRadius: 6,
              background: C.surface, color: C.ink, outline: 'none',
              fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
        </Field>
        {error && <div style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <Btn onClick={onClose} style={{ flex: 1 }}>취소</Btn>
          <Btn variant="primary" onClick={handleSubmit} style={{ flex: 2 }}>
            {mode === 'set' ? '비밀번호 설정 후 입장' : '입장'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function AdminPanel({ lawyerProfile, setLawyerProfile, announcements, setAnnouncements,
  templateConfig, setTemplateConfig, onClose }) {
  const [tab, setTab] = useState('profile'); // 'profile' | 'notices' | 'template'
  const [saved, setSaved] = useState(false);

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 1800); };

  const saveLawyerProfile = async (lp) => {
    setLawyerProfile(lp);
    await _storage.set('lawyer_profile', JSON.stringify(lp), true);
    showSaved();
  };

  const saveAnnouncements = async (list) => {
    setAnnouncements(list);
    await _storage.set('announcements', JSON.stringify(list), true);
    showSaved();
  };

  const saveTemplateConfig = async (cfg) => {
    setTemplateConfig(cfg);
    await _storage.set('template_config', JSON.stringify(cfg), true);
    showSaved();
  };

  const TABS = [
    { id: 'profile', label: '내 정보' },
    { id: 'notices', label: '법령 공지' },
    { id: 'template', label: '서식 편집' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,15,15,0.5)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
      zIndex: 100,
    }}>
      <div style={{
        background: C.surface, width: '100%', maxWidth: 540, height: '100%',
        borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.12)',
      }}>
        <div style={{
          padding: '16px 22px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', background: C.surface,
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>관리자 설정</div>
          {saved && (
            <span style={{ marginLeft: 12, fontSize: 12, color: C.success,
              display: 'flex', alignItems: 'center', gap: 4 }}>
              <CircleCheck size={13} /> 저장됨
            </span>
          )}
          <button onClick={onClose} style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', padding: 4, color: C.inkSubtle,
          }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '12px 8px', fontSize: 13, fontFamily: 'inherit',
              fontWeight: tab === t.id ? 600 : 400, cursor: 'pointer',
              color: tab === t.id ? C.accent : C.inkMuted,
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${tab === t.id ? C.accent : 'transparent'}`,
            }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 22px' }}>
          {tab === 'profile' && (
            <ProfileTab lp={lawyerProfile} onSave={saveLawyerProfile} />
          )}
          {tab === 'notices' && (
            <NoticesTab list={announcements} onSave={saveAnnouncements} />
          )}
          {tab === 'template' && (
            <TemplateTab cfg={templateConfig} onSave={saveTemplateConfig} />
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ lp, onSave }) {
  const [form, setForm] = useState({ ...lp });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 13, color: C.inkMuted, lineHeight: 1.6 }}>
        여기에 입력한 정보는 PDF 표지 하단과 변호사 명함 페이지에 자동으로 삽입됩니다.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="성명" required>
          <TextInput value={form.name} onChange={v => set('name', v)} placeholder="홍길동" />
        </Field>
        <Field label="변호사 등록번호">
          <TextInput value={form.barNumber} onChange={v => set('barNumber', v)} placeholder="12345" />
        </Field>
      </div>
      <Field label="사무소(법무법인)명">
        <TextInput value={form.firm} onChange={v => set('firm', v)} placeholder="법무법인 ○○○" />
      </Field>
      <Field label="사무소 주소">
        <TextInput value={form.firmAddress} onChange={v => set('firmAddress', v)} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="전화">
          <TextInput value={form.phone} onChange={v => set('phone', v)} />
        </Field>
        <Field label="이메일">
          <TextInput value={form.email} onChange={v => set('email', v)} />
        </Field>
      </div>
      <Field label="홈페이지">
        <TextInput value={form.website} onChange={v => set('website', v)} placeholder="https://" />
      </Field>
      <Field label="한 줄 소개 (PDF 하단에 표시)">
        <TextInput value={form.tagline} onChange={v => set('tagline', v)}
          placeholder="가맹사업 전문 변호사 | 10년 경력" />
      </Field>
      <div style={{ marginTop: 8 }}>
        <Btn variant="primary" onClick={() => onSave(form)}>
          <CircleCheck size={14} /> 저장
        </Btn>
      </div>
      {form.name && (
        <div style={{
          marginTop: 8, padding: '14px 16px', background: C.surfaceAlt,
          borderRadius: 8, border: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 11, color: C.inkSubtle, marginBottom: 8, fontWeight: 500 }}>
            PDF 미리보기
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{form.name} 변호사</div>
          {form.firm && <div style={{ fontSize: 12, color: C.inkMuted }}>{form.firm}</div>}
          {(form.phone || form.email) && (
            <div style={{ fontSize: 11, color: C.inkSubtle, marginTop: 4 }}>
              {[form.phone, form.email].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NoticesTab({ list, onSave }) {
  const [items, setItems] = useState(list || []);
  const [editing, setEditing] = useState(null);

  const add = () => {
    const blank = {
      id: `ann_${Date.now()}`,
      title: '',
      content: '',
      effectiveDate: '',
      affectedSections: [],
      createdAt: new Date().toISOString(),
    };
    setEditing(blank);
  };

  const save = (item) => {
    const updated = items.find(x => x.id === item.id)
      ? items.map(x => x.id === item.id ? item : x)
      : [...items, item];
    setItems(updated);
    onSave(updated);
    setEditing(null);
  };

  const del = (id) => {
    const updated = items.filter(x => x.id !== id);
    setItems(updated);
    onSave(updated);
  };

  if (editing) {
    return <NoticeEditor ann={editing} onSave={save} onCancel={() => setEditing(null)} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13, color: C.inkMuted, lineHeight: 1.6 }}>
        공지를 추가하면 사용자가 다음에 사이트를 열 때 팝업으로 표시됩니다.
        법령 개정 사항을 여기서 빠르게 공지하세요.
      </div>
      <div>
        <Btn variant="primary" onClick={add}><Plus size={13} /> 새 공지 추가</Btn>
      </div>
      {items.length === 0 && (
        <div style={{ padding: '28px', textAlign: 'center', fontSize: 12, color: C.inkSubtle,
          background: C.surfaceAlt, borderRadius: 8 }}>
          아직 공지가 없습니다.
        </div>
      )}
      {items.map(item => (
        <div key={item.id} style={{
          padding: '14px 16px', border: `1px solid ${C.border}`,
          borderRadius: 8, background: C.surface,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{item.title}</div>
              {item.effectiveDate && (
                <div style={{ fontSize: 11, color: C.inkSubtle, marginTop: 3 }}>
                  시행일: {item.effectiveDate}
                </div>
              )}
              <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 6, lineHeight: 1.6 }}>
                {item.content.slice(0, 80)}{item.content.length > 80 ? '…' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <Btn size="sm" onClick={() => setEditing(item)}>수정</Btn>
              <Btn size="sm" variant="danger" onClick={() => del(item.id)}>삭제</Btn>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NoticeEditor({ ann, onSave, onCancel }) {
  const [form, setForm] = useState({ ...ann });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const sectionOptions = SECTIONS.map(s => s.roman + '. ' + s.short);

  const toggleSection = (label) => {
    const list = form.affectedSections || [];
    set('affectedSections', list.includes(label) ? list.filter(x => x !== label) : [...list, label]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Btn variant="quiet" size="sm" onClick={onCancel}><ArrowLeft size={13} /> 목록</Btn>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>
          {ann.title ? '공지 수정' : '새 공지'}
        </div>
      </div>
      <Field label="제목" required>
        <TextInput value={form.title} onChange={v => set('title', v)}
          placeholder="가맹사업법 시행령 개정 (2025.01.01)" />
      </Field>
      <Field label="시행일">
        <TextInput value={form.effectiveDate} onChange={v => set('effectiveDate', v)} placeholder="2025-01-01" />
      </Field>
      <Field label="상세 내용">
        <TextArea rows={5} value={form.content} onChange={v => set('content', v)}
          placeholder="어떤 조항이 바뀌었는지, 어떻게 대응해야 하는지 설명합니다." />
      </Field>
      <Field label="영향받는 단계">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {sectionOptions.map(s => {
            const selected = (form.affectedSections || []).includes(s);
            return (
              <button key={s} onClick={() => toggleSection(s)} style={{
                padding: '4px 10px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
                borderRadius: 999, border: `1px solid ${selected ? C.accent : C.border}`,
                background: selected ? C.accentLight : 'transparent',
                color: selected ? C.accent : C.inkMuted, fontWeight: selected ? 500 : 400,
              }}>
                {s}
              </button>
            );
          })}
        </div>
      </Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn onClick={onCancel}>취소</Btn>
        <Btn variant="primary" onClick={() => onSave(form)} disabled={!form.title}>
          <CircleCheck size={13} /> 저장
        </Btn>
      </div>
    </div>
  );
}

function TemplateTab({ cfg, onSave }) {
  const [form, setForm] = useState(cfg || {});
  const setSection = (sid, k, v) =>
    setForm(f => ({ ...f, [sid]: { ...(f[sid] || {}), [k]: v } }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: 13, color: C.inkMuted, lineHeight: 1.6 }}>
        각 단계별 안내 문구를 수정합니다. 법령이 개정되어 특정 섹션에 특별 주의사항을 추가하고 싶을 때 <strong>공지 박스</strong>를 사용하세요. 사용자가 해당 섹션에서 노란 박스로 확인합니다.
      </div>
      {SECTIONS.map(s => {
        const sid = `s${s.id}`;
        const cur = form[sid] || {};
        return (
          <div key={s.id} style={{
            border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 14px', background: C.surfaceAlt,
              fontSize: 13, fontWeight: 600, color: C.ink,
              borderBottom: `1px solid ${C.border}`,
            }}>
              {s.roman}. {s.short}
            </div>
            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Field label="섹션 설명 (폼 상단)" hint="기본값 사용 시 비워두세요">
                <TextArea rows={2} value={cur.description || ''}
                  onChange={v => setSection(sid, 'description', v)}
                  placeholder={`Ⅰ장 기재 안내...`} />
              </Field>
              <Field label="법령 변경 공지 박스" hint="입력 시 노란 경고 박스로 표시">
                <TextArea rows={2} value={cur.notice || ''}
                  onChange={v => setSection(sid, 'notice', v)}
                  placeholder="예: 2025.1.1 개정으로 ○○항목 추가 기재 필요" />
              </Field>
            </div>
          </div>
        );
      })}
      <div>
        <Btn variant="primary" onClick={() => onSave(form)}>
          <CircleCheck size={14} /> 전체 저장
        </Btn>
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

  // New state for lawyer features
  const [lawyerProfile, setLawyerProfile] = useState({
    name: '', barNumber: '', firm: '', firmAddress: '',
    phone: '', email: '', website: '', tagline: '',
  });
  const [announcements, setAnnouncements] = useState([]);
  const [templateConfig, setTemplateConfig] = useState({});
  const [pendingAnnouncements, setPendingAnnouncements] = useState([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminGate, setAdminGate] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Initial load
  useEffect(() => {
    (async () => {
      const [loadedDocs, lpRaw, annRaw, cfgRaw, dismissedRaw] = await Promise.all([
        loadAllDocs(),
        (async () => { try { const r = await _storage.get('lawyer_profile', true); return r ? JSON.parse(r.value) : null; } catch (e) { return null; } })(),
        (async () => { try { const r = await _storage.get('announcements', true); return r ? JSON.parse(r.value) : []; } catch (e) { return []; } })(),
        (async () => { try { const r = await _storage.get('template_config', true); return r ? JSON.parse(r.value) : {}; } catch (e) { return {}; } })(),
        (async () => { try { const r = await _storage.get('dismissed_ann'); return r ? JSON.parse(r.value) : []; } catch (e) { return []; } })(),
      ]);
      setDocs(loadedDocs);
      if (lpRaw) setLawyerProfile(lpRaw);
      if (annRaw) {
        setAnnouncements(annRaw);
        const pending = annRaw.filter(a => !(dismissedRaw || []).includes(a.id));
        if (pending.length > 0) setPendingAnnouncements(pending);
      }
      if (cfgRaw) setTemplateConfig(cfgRaw);
    })();
  }, []);

  const dismissAnnouncements = useCallback(async () => {
    const ids = pendingAnnouncements.map(a => a.id);
    try { await _storage.set('dismissed_ann', JSON.stringify(ids)); } catch (e) {}
    setPendingAnnouncements([]);
  }, [pendingAnnouncements]);

  const handleCreate = useCallback(async (brand, pwHash) => {
    const doc = emptyDoc(brand);
    doc.pwHash = pwHash || '';
    await saveDoc(doc);
    setDocs(prev => [doc, ...(prev || [])]);
    setActiveDoc(doc);
    setView({ name: 'wizard' });
  }, []);

  const handleOpen = useCallback(async (id) => {
    const d = (docs || []).find(x => x.id === id);
    if (d) { setActiveDoc(d); setView({ name: 'wizard' }); }
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
      const out = [...prev]; out[idx] = next; return out;
    });
  }, []);

  const handleBackToDashboard = useCallback(() => {
    setView({ name: 'dashboard' }); setActiveDoc(null);
  }, []);

  const handleReview = useCallback(() => { setView({ name: 'review' }); }, []);

  const handleJumpToStep = useCallback((stepId) => {
    setActiveDoc(prev => prev ? { ...prev, currentStep: stepId } : prev);
    setView({ name: 'wizard' });
  }, []);

  const handlePrint = useCallback(() => {
    setTimeout(() => { try { window.print(); } catch (e) {} }, 100);
  }, []);

  if (docs === null) {
    return (
      <div className="fc-app" style={{ minHeight: '100vh', background: C.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <GlobalStyles />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.inkMuted }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13 }}>저장된 문서를 불러오는 중…</span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="fc-app">
      <GlobalStyles />

      {/* Announcement popup — shown on dashboard load */}
      {pendingAnnouncements.length > 0 && view.name === 'dashboard' && (
        <AnnouncementPopup
          announcements={pendingAnnouncements}
          onDismissAll={dismissAnnouncements}
        />
      )}

      {/* Admin gate modal */}
      {adminGate && (
        <AdminGate
          onEnter={() => { setAdminGate(false); setShowAdmin(true); setIsAdmin(true); }}
          onClose={() => setAdminGate(false)}
        />
      )}

      {/* Admin panel slide-over */}
      {showAdmin && (
        <AdminPanel
          lawyerProfile={lawyerProfile}
          setLawyerProfile={setLawyerProfile}
          announcements={announcements}
          setAnnouncements={setAnnouncements}
          templateConfig={templateConfig}
          setTemplateConfig={setTemplateConfig}
          onClose={() => setShowAdmin(false)}
        />
      )}

      <div className="fc-app-chrome">
        {view.name === 'dashboard' && (
          <Dashboard
            docs={docs}
            onOpen={handleOpen}
            onCreate={handleCreate}
            onDelete={handleDelete}
            onAdmin={() => setAdminGate(true)}
            lawyerProfile={lawyerProfile}
            isAdmin={isAdmin}
          />
        )}
        {view.name === 'wizard' && activeDoc && (
          <Wizard
            doc={activeDoc}
            onUpdate={handleUpdate}
            onBack={handleBackToDashboard}
            onReview={handleReview}
            templateConfig={templateConfig}
            lawyerProfile={lawyerProfile}
            onAdmin={() => setAdminGate(true)}
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

      {/* Always-rendered print template */}
      {activeDoc && <PrintView doc={activeDoc} />}
    </div>
  );
}

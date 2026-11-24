import { useState, useRef, useEffect } from 'react';
import {
  PenTool, Eraser, RotateCcw, Download, Lock, Users, UserCheck,
  Sparkles, BookOpen, SplitSquareHorizontal, Award, Eye
} from 'lucide-react';
import {
  TAJWEED_PENS,
  PEN_COLOR_MAP,
  HARAKAT_STAMPS,
  TRACING_LETTERS,
  stripArabicTashkeel,
  splitIntoArabicSyllables,
  simplifyPointsToSvgPath,
  createClientStrokeId,
  exportSvgBoardAsPng,
} from './whiteboardUtils';

function BoardSvgSurface({
  svgRef = null,
  mode = 'ayah',
  ayahText = '',
  compareText = '',
  stripTashkeel = false,
  syllableMode = false,
  tracingLetter = 'ب',
  strokes = [],
  stamps = [],
  draftPath = '',
  draftColorKey = 'emerald',
  canDraw = false,
  activeTool = 'pen',
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onRemoveStamp,
}) {
  const displayAyah = stripTashkeel ? stripArabicTashkeel(ayahText) : ayahText;
  const displayCompare = stripTashkeel ? stripArabicTashkeel(compareText) : compareText;
  const syllables = syllableMode && ayahText ? splitIntoArabicSyllables(ayahText) : [];

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1000 600"
      className={`w-full h-full select-none touch-none rounded-2xl border-2 border-[var(--wn-border-strong)] bg-[var(--wn-bg)] shadow-inner ${
        canDraw ? 'cursor-crosshair' : 'cursor-default'
      }`}
      onPointerDown={canDraw ? onPointerDown : undefined}
      onPointerMove={canDraw ? onPointerMove : undefined}
      onPointerUp={canDraw ? onPointerUp : undefined}
      onPointerCancel={canDraw ? onPointerUp : undefined}
    >
      {/* إطار اللوح القرآني والسطر الإرشادي للخط العربي */}
      <rect x="14" y="14" width="972" height="572" rx="18" fill="none" stroke="var(--wn-border)" strokeWidth="2" />
      <line x1="60" y1="340" x2="940" y2="340" stroke="var(--wn-border-strong)" strokeWidth="2" strokeDasharray="10 8" />
      <line x1="60" y1="450" x2="940" y2="450" stroke="var(--wn-border)" strokeWidth="1" strokeDasharray="6 8" />

      {/* الوضع ٢: تتبّع الحروف المنقّطة للأطفال */}
      {mode === 'tracing' && !syllableMode && (
        <g>
          <text
            x="500"
            y="345"
            textAnchor="middle"
            fontSize="240"
            fontFamily="Amiri, serif"
            fill="none"
            stroke="var(--wn-border-strong)"
            strokeWidth="5"
            strokeDasharray="10 10"
          >
            {tracingLetter}
          </text>
          <text
            x="500"
            y="345"
            textAnchor="middle"
            fontSize="240"
            fontFamily="Amiri, serif"
            fill="var(--wn-gold-soft)"
            opacity="0.45"
          >
            {tracingLetter}
          </text>
          <text x="500" y="90" textAnchor="middle" fontSize="22" fontWeight="bold" fill="var(--wn-text-secondary)">
            مرِّر إصبعك أو القلم فوق النقاط لكتابة حرف «{tracingLetter}» على السطر (١ ← ٢)
          </text>
        </g>
      )}

      {/* تفكيك المقاطع الصوتية البصري */}
      {syllableMode && syllables.length > 0 && (
        <g>
          <text x="500" y="95" textAnchor="middle" fontSize="22" fontWeight="bold" fill="var(--wn-heading)">
            المقاطع الصوتية للتهجئة السليمة (اقرأ كل بطاقة كمقطع واحد):
          </text>
          {syllables.slice(0, 8).map((syl, idx) => {
            const count = Math.min(8, syllables.length);
            const boxW = 104;
            const gap = 14;
            const totalW = count * boxW + (count - 1) * gap;
            const startRightX = 500 + totalW / 2 - boxW;
            const x = startRightX - idx * (boxW + gap);
            return (
              <g key={`${syl}-${idx}`}>
                <rect
                  x={x}
                  y="215"
                  width={boxW}
                  height="110"
                  rx="16"
                  fill="var(--wn-surface)"
                  stroke="var(--wn-emerald)"
                  strokeWidth="3"
                />
                <text
                  x={x + boxW / 2}
                  y="285"
                  textAnchor="middle"
                  fontSize="44"
                  fontFamily="Amiri, serif"
                  fontWeight="bold"
                  fill="var(--wn-heading)"
                >
                  {syl}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* الوضع ١ أو ٣: نص الآية أو الكلمة القرآنية أو مقارنة المتشابهات */}
      {mode !== 'tracing' && !syllableMode && displayAyah && (
        compareText ? (
          <g>
            <line x1="500" y1="60" x2="500" y2="540" stroke="var(--wn-gold)" strokeWidth="3" strokeDasharray="8 6" />
            <text x="745" y="95" textAnchor="middle" fontSize="20" fontWeight="bold" fill="var(--wn-badge-gold-text)">
              الموضع الأول
            </text>
            <text
              x="745"
              y="290"
              textAnchor="middle"
              fontSize="42"
              fontFamily="Amiri, serif"
              fontWeight="bold"
              fill="var(--wn-heading)"
            >
              {displayAyah.slice(0, 42)}
            </text>
            <text x="255" y="95" textAnchor="middle" fontSize="20" fontWeight="bold" fill="var(--wn-badge-gold-text)">
              الموضع المتشابه
            </text>
            <text
              x="255"
              y="290"
              textAnchor="middle"
              fontSize="42"
              fontFamily="Amiri, serif"
              fontWeight="bold"
              fill="var(--wn-heading)"
            >
              {displayCompare.slice(0, 42)}
            </text>
          </g>
        ) : (
          <text
            x="500"
            y="315"
            textAnchor="middle"
            fontSize={displayAyah.length > 35 ? '44' : '68'}
            fontFamily="Amiri, serif"
            fontWeight="bold"
            fill="var(--wn-heading)"
          >
            {displayAyah.slice(0, 68)}
          </text>
        )
      )}

      {/* الخطوط المتجهية المرسومة */}
      {strokes.map((st) => (
        <path
          key={st.id}
          d={st.d}
          fill="none"
          stroke={PEN_COLOR_MAP[st.colorKey] || 'var(--wn-emerald)'}
          strokeWidth={st.width || 4}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={st.colorKey === 'laser' ? 0.85 : 0.92}
        />
      ))}

      {/* المسار الجاري رسمه حالياً بـ 60 إطار/ثانية */}
      {draftPath && (
        <path
          d={draftPath}
          fill="none"
          stroke={PEN_COLOR_MAP[draftColorKey] || 'var(--wn-emerald)'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* أختام التشكيل والتجويد الموضوعة على السبورة */}
      {stamps.map((sp) => (
        <g
          key={sp.id}
          onClick={(e) => {
            if (canDraw && activeTool === 'eraser' && onRemoveStamp) {
              e.stopPropagation();
              onRemoveStamp(sp.id);
            }
          }}
          className={canDraw && activeTool === 'eraser' ? 'cursor-pointer' : undefined}
        >
          <circle cx={sp.x} cy={sp.y - 12} r="24" fill="var(--wn-gold-soft)" opacity="0.55" />
          <text
            x={sp.x}
            y={sp.y}
            textAnchor="middle"
            fontSize="54"
            fontFamily="Amiri, serif"
            fontWeight="bold"
            fill={PEN_COLOR_MAP[sp.colorKey] || 'var(--wn-danger)'}
          >
            {sp.glyph}
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * السبورة القرآنية التفاعلية الذكية (3 أوضاع مدمجة + خفة متجهية فائقة)
 */
export default function SmartQuranWhiteboard({
  isTeacher = false,
  isObserver = false,
  currentUserId = '',
  rosterStudents = [],
  whiteboardState = {},
  onHostUpdateWhiteboard,
  onStudentWhiteboardAction,
  dir = 'rtl',
}) {
  const [activeTool, setActiveTool] = useState('pen'); // 'pen' | 'stamp' | 'eraser'
  const [selectedPen, setSelectedPen] = useState('emerald');
  const [selectedStamp, setSelectedStamp] = useState(HARAKAT_STAMPS[0]);
  const [customInput, setCustomInput] = useState('');
  const [compareInput, setCompareInput] = useState('');
  const [showCompareEditor, setShowCompareEditor] = useState(false);
  const [draftPath, setDraftPath] = useState('');
  const [nowCutoff, setNowCutoff] = useState(0);

  const svgRef = useRef(null);
  const drawingPointsRef = useRef([]);
  const isDrawingRef = useRef(false);

  const mode = whiteboardState?.mode || 'ayah';
  const permission = whiteboardState?.permission || 'teacher_only';
  const boardsFrozen = Boolean(whiteboardState?.boardsFrozen);
  const delegatedStudentId = whiteboardState?.delegatedStudentId || '';
  const featuredStudentId = whiteboardState?.featuredStudentId || '';
  const ayahText = whiteboardState?.ayahText || 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
  const compareText = whiteboardState?.compareText || '';
  const stripTashkeel = Boolean(whiteboardState?.stripTashkeel);
  const syllableMode = Boolean(whiteboardState?.syllableMode);
  const tracingLetter = whiteboardState?.tracingLetter || 'ب';
  const serverStrokes = Array.isArray(whiteboardState?.strokes) ? whiteboardState.strokes : [];
  const rawStrokes = nowCutoff > 0
    ? serverStrokes.filter((s) => !s.expiresAt || s.expiresAt > nowCutoff)
    : serverStrokes;
  const mainStamps = Array.isArray(whiteboardState?.stamps) ? whiteboardState.stamps : [];
  const studentBoardsMap = whiteboardState?.studentBoards || {};

  // Auto-clean expired 3.5-second laser strokes smoothly on client
  useEffect(() => {
    const strokesArr = Array.isArray(whiteboardState?.strokes) ? whiteboardState.strokes : [];
    const hasLaser = strokesArr.some((s) => s.expiresAt && s.expiresAt > 0);
    if (!hasLaser) return undefined;
    const timer = setTimeout(() => {
      setNowCutoff(Date.now());
    }, 1200);
    return () => clearTimeout(timer);
  }, [whiteboardState?.strokes]);

  const isMiniBoardStudentView = !isTeacher && !isObserver && permission === 'all_miniboards' && !featuredStudentId;
  const myMiniBoard = studentBoardsMap[String(currentUserId)] || { strokes: [], stamps: [], badge: '' };
  const featuredBoard = featuredStudentId ? studentBoardsMap[featuredStudentId] : null;

  const canDrawOnActiveSurface =
    !isObserver &&
    (isTeacher ||
      (!boardsFrozen &&
        ((permission === 'delegated' && String(currentUserId) === String(delegatedStudentId)) ||
          isMiniBoardStudentView)));

  const activeStrokes = featuredBoard
    ? featuredBoard.strokes || []
    : isMiniBoardStudentView
      ? myMiniBoard.strokes || []
      : rawStrokes;

  const activeStamps = featuredBoard
    ? featuredBoard.stamps || []
    : isMiniBoardStudentView
      ? myMiniBoard.stamps || []
      : mainStamps;

  const getSvgCoords = (e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 500, y: 300 };
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 1000;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 600;
    return {
      x: Math.max(15, Math.min(985, x)),
      y: Math.max(15, Math.min(585, y)),
    };
  };

  const emitAction = (payload) => {
    if (isTeacher) {
      onHostUpdateWhiteboard?.(payload);
    } else {
      onStudentWhiteboardAction?.(payload);
    }
  };

  const handlePointerDown = (e) => {
    if (!canDrawOnActiveSurface) return;
    const pt = getSvgCoords(e);

    if (activeTool === 'stamp') {
      emitAction({
        addStamp: {
          id: createClientStrokeId('sp'),
          glyph: selectedStamp.glyph,
          x: Math.round(pt.x),
          y: Math.round(pt.y),
          colorKey: selectedPen === 'laser' ? 'madd' : selectedPen,
        },
      });
      return;
    }

    if (activeTool !== 'pen') return;

    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    isDrawingRef.current = true;
    drawingPointsRef.current = [pt];
    setDraftPath(`M${Math.round(pt.x)} ${Math.round(pt.y)}`);
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current || activeTool !== 'pen') return;
    const pt = getSvgCoords(e);
    drawingPointsRef.current.push(pt);
    setDraftPath(simplifyPointsToSvgPath(drawingPointsRef.current, 4));
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const simplifiedD = simplifyPointsToSvgPath(drawingPointsRef.current, 6);
    drawingPointsRef.current = [];
    setDraftPath('');

    if (!simplifiedD) return;
    const penConfig = TAJWEED_PENS.find((p) => p.id === selectedPen) || TAJWEED_PENS[0];
    emitAction({
      addStroke: {
        id: createClientStrokeId('st'),
        colorKey: penConfig.id,
        width: penConfig.width,
        d: simplifiedD,
      },
    });
  };

  const studentBoardsList = Object.values(studentBoardsMap);

  return (
    <div className="w-full h-full flex flex-col gap-2.5 p-2 md:p-3 bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] overflow-y-auto" dir={dir}>
      {/* الشريط العلوي: أوضاع السبورة الثلاثة + الصلاحيات + الحفظ كصورة */}
      <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'ayah', icon: BookOpen, label: '١. تشريح الآيات والتجويد' },
            { id: 'tracing', icon: Sparkles, label: '٢. تأسيس الأطفال والمقاطع' },
            { id: 'miniboards', icon: Users, label: '٣. ألواح الحلقة المستقلة' },
          ].map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={!isTeacher}
                onClick={() =>
                  onHostUpdateWhiteboard?.({
                    mode: m.id,
                    ...(m.id === 'miniboards' ? { permission: 'all_miniboards', featuredStudentId: '' } : {}),
                  })
                }
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer disabled:cursor-default ${
                  active
                    ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)]'
                    : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)] border border-[var(--wn-border)]'
                }`}
              >
                <Icon size={14} aria-hidden="true" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* التحكم في صلاحيات الكتابة للمعلم + تنزيل صورة المراجعة */}
        <div className="flex flex-wrap items-center gap-1.5">
          {isTeacher && (
            <>
              <button
                type="button"
                onClick={() => onHostUpdateWhiteboard?.({ permission: 'teacher_only', featuredStudentId: '' })}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 border cursor-pointer ${
                  permission === 'teacher_only'
                    ? 'bg-[var(--wn-gold-soft)] border-[var(--wn-gold)] text-[var(--wn-badge-gold-text)]'
                    : 'bg-[var(--wn-surface-soft)] border-[var(--wn-border)] text-[var(--wn-text-secondary)]'
                }`}
              >
                <Lock size={13} aria-hidden="true" />
                <span>المعلم فقط</span>
              </button>

              {rosterStudents.length > 0 && (
                <select
                  aria-label="تفويض طالب للكتابة"
                  value={permission === 'delegated' ? delegatedStudentId : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      onHostUpdateWhiteboard?.({ permission: 'teacher_only', delegatedStudentId: '', delegatedStudentName: '' });
                    } else {
                      const st = rosterStudents.find((r) => (r.userId || r.id.replace('student:', '')) === val);
                      onHostUpdateWhiteboard?.({
                        permission: 'delegated',
                        delegatedStudentId: val,
                        delegatedStudentName: st?.name || 'طالب',
                        featuredStudentId: '',
                      });
                    }
                  }}
                  className="min-h-[36px] px-2 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs font-bold"
                >
                  <option value="">🎯 فوِّض طالباً…</option>
                  {rosterStudents.map((st) => {
                    const cleanUid = st.userId || String(st.id || '').replace('student:', '');
                    return (
                      <option key={cleanUid} value={cleanUid}>
                        تفويض: {st.name}
                      </option>
                    );
                  })}
                </select>
              )}

              <button
                type="button"
                onClick={() => onHostUpdateWhiteboard?.({ mode: 'miniboards', permission: 'all_miniboards', featuredStudentId: '' })}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 border cursor-pointer ${
                  permission === 'all_miniboards'
                    ? 'bg-[var(--wn-emerald)] border-[var(--wn-emerald)] text-[var(--wn-white)]'
                    : 'bg-[var(--wn-surface-soft)] border-[var(--wn-border)] text-[var(--wn-text-secondary)]'
                }`}
              >
                <UserCheck size={13} aria-hidden="true" />
                <span>لوح لكل طالب</span>
              </button>

              {permission !== 'teacher_only' && (
                <button
                  type="button"
                  onClick={() => onHostUpdateWhiteboard?.({ boardsFrozen: !boardsFrozen })}
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                    boardsFrozen
                      ? 'bg-[var(--wn-danger-soft)] border-[var(--wn-danger)] text-[var(--wn-text-danger)]'
                      : 'bg-[var(--wn-surface-soft)] border-[var(--wn-border)] text-[var(--wn-text-secondary)]'
                  }`}
                >
                  {boardsFrozen ? '❄️ الألواح مجمّدة (فك التجميد)' : '❄️ تجميد ألواح الطلاب'}
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => exportSvgBoardAsPng(svgRef.current, `wahy-board-${mode}.png`)}
            className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[var(--wn-surface-soft)] hover:bg-[var(--wn-emerald-soft)] border border-[var(--wn-border)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            title="حفظ السبورة الحالية كصورة مراجعة للطالب"
          >
            <Download size={13} aria-hidden="true" />
            <span>حفظ كصورة</span>
          </button>
        </div>
      </div>

      {/* أدوات الوضع النشط للمعلم (تشريح الآية / تفكيك المقاطع / اختيار الحرف المنقّط) */}
      {isTeacher && (
        <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-2.5 space-y-2">
          {mode !== 'tracing' ? (
            <div className="flex flex-wrap items-center gap-2">
              <form
                className="flex items-center gap-1.5 flex-1 min-w-[220px]"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customInput.trim()) {
                    onHostUpdateWhiteboard?.({ ayahText: customInput.trim(), clearMainBoard: false });
                    setCustomInput('');
                  }
                }}
              >
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="اكتب كلمة أو آية لعرضها على السبورة…"
                  className="flex-1 min-h-[36px] px-3 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-xs font-serif"
                />
                <button
                  type="submit"
                  className="min-h-[36px] px-3 rounded-xl bg-[var(--wn-emerald)] text-[var(--wn-white)] text-xs font-bold cursor-pointer"
                >
                  عرض على اللوح
                </button>
              </form>

              <button
                type="button"
                onClick={() => onHostUpdateWhiteboard?.({ stripTashkeel: !stripTashkeel })}
                className={`min-h-[36px] px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                  stripTashkeel
                    ? 'bg-[var(--wn-gold-soft)] border-[var(--wn-gold)] text-[var(--wn-badge-gold-text)]'
                    : 'bg-[var(--wn-surface-soft)] border-[var(--wn-border)] text-[var(--wn-text-secondary)]'
                }`}
              >
                {stripTashkeel ? 'إظهار التشكيل الأصلي' : 'اختبر الطالب (إخفاء التشكيل)'}
              </button>

              <button
                type="button"
                onClick={() => onHostUpdateWhiteboard?.({ syllableMode: !syllableMode })}
                className={`min-h-[36px] px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                  syllableMode
                    ? 'bg-[var(--wn-emerald)] border-[var(--wn-emerald)] text-[var(--wn-white)]'
                    : 'bg-[var(--wn-surface-soft)] border-[var(--wn-border)] text-[var(--wn-text-secondary)]'
                }`}
              >
                {syllableMode ? 'دمج الكلمة' : '✂️ تفكيك لمقاطع صوتية'}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (compareText) {
                    onHostUpdateWhiteboard?.({ compareText: '' });
                    setShowCompareEditor(false);
                  } else {
                    setShowCompareEditor((v) => !v);
                  }
                }}
                className="min-h-[36px] px-3 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <SplitSquareHorizontal size={13} aria-hidden="true" />
                <span>{compareText ? 'إلغاء المقارنة' : 'مقارنة متشابهات'}</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-[var(--wn-text-secondary)] me-1">اختر الحرف المنقّط للطفل:</span>
              {TRACING_LETTERS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => onHostUpdateWhiteboard?.({ tracingLetter: ch, syllableMode: false, clearMainBoard: true })}
                  className={`min-w-[34px] min-h-[34px] rounded-lg font-serif text-base font-bold border cursor-pointer ${
                    tracingLetter === ch
                      ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)] border-[var(--wn-emerald)]'
                      : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] border-[var(--wn-border)]'
                  }`}
                >
                  {ch}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onHostUpdateWhiteboard?.({ syllableMode: !syllableMode })}
                className="min-h-[34px] px-2.5 rounded-lg bg-[var(--wn-gold-soft)] border border-[var(--wn-gold)] text-[var(--wn-badge-gold-text)] text-xs font-bold cursor-pointer ms-auto"
              >
                {syllableMode ? 'العودة لتتبّع الحرف' : '✂️ بطاقات المقاطع الصوتية'}
              </button>
            </div>
          )}

          {showCompareEditor && (
            <form
              className="flex items-center gap-2 pt-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (compareInput.trim()) {
                  onHostUpdateWhiteboard?.({ compareText: compareInput.trim() });
                  setShowCompareEditor(false);
                }
              }}
            >
              <input
                type="text"
                value={compareInput}
                onChange={(e) => setCompareInput(e.target.value)}
                placeholder="اكتب الآية المشابهة للمقارنة في العمود الثاني…"
                className="flex-1 min-h-[36px] px-3 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-xs font-serif"
              />
              <button
                type="submit"
                className="min-h-[36px] px-3 rounded-xl bg-[var(--wn-emerald)] text-[var(--wn-white)] text-xs font-bold cursor-pointer"
              >
                تثبيت المقارنة
              </button>
            </form>
          )}
        </div>
      )}

      {/* شريط الأقلام التجويدية وأختام التشكيل (يظهر فقط لمن يملك صلاحية الكتابة) */}
      {canDrawOnActiveSurface && (
        <div className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {TAJWEED_PENS.filter((pen) => isTeacher || !pen.isLaser).map((pen) => (
              <button
                key={pen.id}
                type="button"
                onClick={() => {
                  setActiveTool('pen');
                  setSelectedPen(pen.id);
                }}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg font-bold border inline-flex items-center gap-1 cursor-pointer ${
                  activeTool === 'pen' && selectedPen === pen.id
                    ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)] border-[var(--wn-emerald)]'
                    : 'bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] border-[var(--wn-border)]'
                }`}
              >
                <PenTool size={12} aria-hidden="true" />
                <span>{pen.labelAr}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[var(--wn-text-secondary)] font-bold">أختام:</span>
            {HARAKAT_STAMPS.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setActiveTool('stamp');
                  setSelectedStamp(st);
                }}
                title={st.labelAr}
                className={`min-w-[34px] min-h-[34px] px-1.5 rounded-lg font-serif text-base font-bold border cursor-pointer ${
                  activeTool === 'stamp' && selectedStamp.id === st.id
                    ? 'bg-[var(--wn-gold-soft)] border-[var(--wn-gold)] text-[var(--wn-badge-gold-text)]'
                    : 'bg-[var(--wn-surface-soft)] border-[var(--wn-border)] text-[var(--wn-heading)]'
                }`}
              >
                {st.symbol}
              </button>
            ))}

            {isTeacher && (
              <button
                type="button"
                onClick={() => setActiveTool('eraser')}
                className={`min-h-[34px] px-2 rounded-lg border font-bold inline-flex items-center gap-1 cursor-pointer ${
                  activeTool === 'eraser'
                    ? 'bg-[var(--wn-danger-soft)] border-[var(--wn-danger)] text-[var(--wn-text-danger)]'
                    : 'bg-[var(--wn-surface-soft)] border-[var(--wn-border)] text-[var(--wn-text-secondary)]'
                }`}
                title="اضغط على أي ختم لحذفه"
              >
                <Eraser size={13} aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isTeacher) {
                  onHostUpdateWhiteboard?.({ undoLastStroke: true });
                } else {
                  onStudentWhiteboardAction?.({ clearMine: true });
                }
              }}
              className="min-h-[34px] px-2.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={12} aria-hidden="true" />
              <span>{isTeacher ? 'تراجع' : 'مسح لوحي'}</span>
            </button>

            {isTeacher && (
              <button
                type="button"
                onClick={() => onHostUpdateWhiteboard?.({ clearMainBoard: true })}
                className="min-h-[34px] px-2.5 rounded-lg bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)] font-bold cursor-pointer"
              >
                مسح الكل
              </button>
            )}
          </div>
        </div>
      )}

      {/* تنبيه حالة اللوح للطالب */}
      {!isTeacher && (
        <div className="px-3 py-1.5 rounded-xl bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[var(--wn-badge-emerald-text)]">
          <span>
            {boardsFrozen
              ? '❄️ قام المعلم بتجميد الألواح لمراجعة الإجابات وتصحيحها'
              : featuredBoard
                ? `🌟 يعرض المعلم الآن لوح الطالب المتفوق: ${featuredBoard.studentName}`
                : isMiniBoardStudentView
                  ? '🧩 هذا لوحك الشخصي المستقل — ارسم أو ضع أختام التشكيل وسيرى المعلم إجابتك مباشرة!'
                  : permission === 'delegated' && String(currentUserId) === String(delegatedStudentId)
                    ? '🎯 فوّضك المعلم للكتابة الآن على السبورة الرئيسية أمام زملائك!'
                    : '👀 أنت تتابع شرح المعلم المباشر على السبورة'}
          </span>
          {isMiniBoardStudentView && myMiniBoard.badge === 'star' && (
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] border border-[var(--wn-gold)]">
              🌟 أحسنت! اعتمد المعلم لوحك (+٢ نجمة)
            </span>
          )}
          {isMiniBoardStudentView && myMiniBoard.badge === 'retry' && (
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)]">
              🔄 راجع الحركة وحاول مجدداً
            </span>
          )}
        </div>
      )}

      {/* في وضع ألواح الحلقة الجماعية للمعلم: شبكة معاينات SVG الخفيفة لجميع ألواح الطلاب! */}
      {isTeacher && mode === 'miniboards' && permission === 'all_miniboards' && !featuredBoard ? (
        <div className="flex-1 rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-4 space-y-3 overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-[var(--wn-heading)]">
                🧩 شبكة ألواح طلاب الحلقة المباشرة ({studentBoardsList.length} ألواح نشطة)
              </h4>
              <p className="text-xs text-[var(--wn-text-secondary)]">
                يعمل كل طالب في لوحه المستقل دون رؤية إجابة زملائه — راقب تقدمهم واختم بضغطة واحدة:
              </p>
            </div>
            {studentBoardsList.length > 0 && (
              <button
                type="button"
                onClick={() => onHostUpdateWhiteboard?.({ clearStudentBoards: true })}
                className="min-h-[36px] px-3 rounded-xl border border-[var(--wn-border)] text-xs font-bold cursor-pointer"
              >
                تفريغ جميع ألواح الطلاب لجولة جديدة
              </button>
            )}
          </div>

          {studentBoardsList.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[var(--wn-surface-soft)] border border-dashed border-[var(--wn-border-strong)] text-xs text-[var(--wn-text-secondary)]">
              بانتظار بدء الطلاب بالكتابة أو وضع أختام التشكيل على ألواحهم الفردية…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {studentBoardsList.map((sb) => (
                <div
                  key={sb.studentId}
                  className="p-3 rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[var(--wn-heading)]">{sb.studentName}</span>
                    {sb.badge === 'star' && <span className="text-xs font-bold text-[var(--wn-badge-gold-text)]">🌟 متقن</span>}
                    {sb.badge === 'retry' && <span className="text-xs font-bold text-[var(--wn-text-danger)]">🔄 يحتاج مراجعة</span>}
                  </div>
                  <div className="h-36">
                    <BoardSvgSurface
                      mode="ayah"
                      ayahText={ayahText}
                      stripTashkeel={stripTashkeel}
                      syllableMode={syllableMode}
                      tracingLetter={tracingLetter}
                      strokes={sb.strokes || []}
                      stamps={sb.stamps || []}
                      canDraw={false}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onHostUpdateWhiteboard?.({
                          reviewStudentBoard: { studentId: sb.studentId, badge: 'star' },
                        })
                      }
                      className="flex-1 min-h-[34px] rounded-lg bg-[var(--wn-emerald)] text-[var(--wn-white)] text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Award size={12} aria-hidden="true" />
                      <span>متقن +٢⭐</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onHostUpdateWhiteboard?.({
                          reviewStudentBoard: { studentId: sb.studentId, badge: 'retry' },
                        })
                      }
                      className="min-h-[34px] px-2.5 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-xs font-bold cursor-pointer"
                    >
                      🔄 راجع
                    </button>
                    <button
                      type="button"
                      onClick={() => onHostUpdateWhiteboard?.({ featuredStudentId: sb.studentId })}
                      className="min-h-[34px] px-2.5 rounded-lg bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                      title="عرض لوح هذا الطالب أمام الفصل كقدوة"
                    >
                      <Eye size={12} aria-hidden="true" />
                      <span>عرض</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-[320px] relative">
          {isTeacher && featuredBoard && (
            <button
              type="button"
              onClick={() => onHostUpdateWhiteboard?.({ featuredStudentId: '' })}
              className="absolute top-3 start-3 z-20 min-h-[36px] px-3 rounded-xl bg-[var(--wn-emerald)] text-[var(--wn-white)] text-xs font-bold shadow-md cursor-pointer"
            >
              العودة لشبكة ألواح الطلاب
            </button>
          )}
          <BoardSvgSurface
            svgRef={svgRef}
            mode={mode}
            ayahText={ayahText}
            compareText={compareText}
            stripTashkeel={stripTashkeel}
            syllableMode={syllableMode}
            tracingLetter={tracingLetter}
            strokes={activeStrokes}
            stamps={activeStamps}
            draftPath={draftPath}
            draftColorKey={selectedPen}
            canDraw={canDrawOnActiveSurface}
            activeTool={activeTool}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onRemoveStamp={(stampId) => onHostUpdateWhiteboard?.({ removeStampId: stampId })}
          />
        </div>
      )}
    </div>
  );
}

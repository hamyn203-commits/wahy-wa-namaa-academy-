import { useState } from 'react';
import { useI18n } from '../../../i18n';
import { useMarket } from '../../../context/MarketProvider';
import {
  Calculator,
  Users,
  Heart,
  Clock3,
  Check,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Crown,
  CalendarRange,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';
import { handleRovingKeyDown, pickLocale } from '../landingI18n';
import { CALCULATOR_COPY } from '../landingI18nPart2';

const CALCULATOR_PLANS = [
  {
    id: 'community',
    price: 10,
    i18n: {
      ar: { name: 'الحلقة الاقتصادية الكبرى', badge: 'الأوفر', students: 'من 15 إلى 20 طالب', duration: 'من ساعة إلى ساعتين', recitation: 'تسميع بالدور ومتابعة مستمرة', features: ['أقل تكلفة للاستمرار في الحفظ والمراجعة', 'بيئة جماعية مشجعة ومنظمة', 'تقارير حضور وتقدم دورية'] },
      en: { name: 'Community Circle', badge: 'Best value', students: '15–20 students', duration: '1–2 hours', recitation: 'Turn-based recitation & continuous follow-up', features: ['Lowest cost for steady memorization and review', 'Encouraging, structured group circle', 'Regular attendance and progress reports'] },
      fr: { name: 'Grand cercle communautaire', badge: 'Économique', students: '15 à 20 élèves', duration: '1 à 2 heures', recitation: 'Récitation à tour de rôle & suivi continu', features: ['Coût minimal pour mémoriser et réviser durablement', 'Cadre collectif motivant et structuré', 'Rapports réguliers d’assiduité et de progrès'] },
      de: { name: 'Großer Gemeinschaftskreis', badge: 'Günstigster', students: '15–20 Lernende', duration: '1–2 Stunden', recitation: 'Reihum-Rezitation & laufende Begleitung', features: ['Niedrigste Kosten für kontinuierliches Lernen', 'Motivierende, strukturierte Gruppenatmosphäre', 'Regelmäßige Anwesenheits- und Fortschrittsberichte'] },
      tr: { name: 'Ekonomik Büyük Halka', badge: 'En ekonomik', students: '15–20 öğrenci', duration: '1–2 saat', recitation: 'Sırayla kıraat ve sürekli takip', features: ['Hıfz ve tekrara devam için en uygun maliyet', 'Teşvik edici ve düzenli grup ortamı', 'Düzenli yoklama ve ilerleme raporları'] },
      ur: { name: 'بڑا اقتصادی حلقہ', badge: 'سب سے کفایتی', students: '15 سے 20 طلبہ', duration: '1 سے 2 گھنٹے', recitation: 'باری باری تلاوت اور مسلسل نگرانی', features: ['حفظ و دہرائی جاری رکھنے کے لیے کم ترین فیس', 'حوصلہ افزا اور منظم اجتماعی ماحول', 'باقاعدہ حاضری اور پیش رفت کی رپورٹس'] },
      id: { name: 'Halaqah Ekonomi Besar', badge: 'Paling hemat', students: '15–20 peserta', duration: '1–2 jam', recitation: 'Setoran bergiliran & pantauan berkala', features: ['Biaya paling terjangkau untuk konsistensi belajar', 'Suasana kelompok yang saling menyemangati', 'Laporan kehadiran dan progres rutin'] },
      ms: { name: 'Halaqah Ekonomi Besar', badge: 'Paling jimat', students: '15–20 pelajar', duration: '1–2 jam', recitation: 'Bacaan bergilir & susulan berterusan', features: ['Kos paling rendah untuk hafazan berterusan', 'Suasana berkumpulan yang teratur dan positif', 'Laporan kehadiran dan kemajuan berkala'] },
      ku: { name: 'بازنەی ئابووریی گەورە', badge: 'هەرزانترین', students: '١٥ تا ٢٠ قوتابی', duration: '١ تا ٢ کاتژمێر', recitation: 'خوێندنەوە بە نۆرە و بەدواداچوونی بەردەوام', features: ['کەمترین تێچوو بۆ بەردەوامبوون لە لەبەرکردن', 'ژینگەیەکی کۆمەڵایەتیی هاندەر و ڕێکخراو', 'ڕاپۆرتی بەردەوامی ئامادەبوون و پێشکەوتن'] },
    },
  },
  {
    id: 'group',
    featured: true,
    price: 20,
    i18n: {
      ar: { name: 'الحلقة الجماعية', badge: 'الأكثر طلبًا', students: 'من 5 إلى 10 طلاب', duration: 'من ساعة إلى ساعتين', recitation: 'وقت تسميع أطول ومتابعة أقرب', features: ['أفضل توازن بين السعر ووقت التسميع الفردي', 'تصحيح مباشر للتلاوة وأحكام التجويد', 'متابعة أسبوعية مع ولي الأمر أو الطالب'] },
      en: { name: 'Group Circle', badge: 'Most popular', students: '5–10 students', duration: '1–2 hours', recitation: 'Longer recitation slot & closer guidance', features: ['Best balance between price and individual recitation time', 'Live recitation and Tajweed correction', 'Weekly follow-up with parent or learner'] },
      fr: { name: 'Cercle collectif', badge: 'Plus populaire', students: '5 à 10 élèves', duration: '1 à 2 heures', recitation: 'Temps de récitation élargi & suivi rapproché', features: ['Meilleur équilibre entre tarif et temps individuel', 'Correction directe de la récitation et du Tajweed', 'Suivi hebdomadaire avec l’élève ou les parents'] },
      de: { name: 'Gruppenkreis', badge: 'Am beliebtesten', students: '5–10 Lernende', duration: '1–2 Stunden', recitation: 'Mehr Rezitationszeit & engere Begleitung', features: ['Bestes Verhältnis aus Preis und individueller Redezeit', 'Direkte Rezitations- und Tajweed-Korrektur', 'Wöchentliche Rückmeldung für Eltern oder Lernende'] },
      tr: { name: 'Grup Halkası', badge: 'En çok tercih edilen', students: '5–10 öğrenci', duration: '1–2 saat', recitation: 'Daha uzun okuma süresi ve yakın takip', features: ['Fiyat ve bireysel okuma süresi arasında en iyi denge', 'Canlı kıraat ve tecvid düzeltmesi', 'Öğrenci veya veliyle haftalık takip'] },
      ur: { name: 'اجتماعی حلقہ', badge: 'سب سے مقبول', students: '5 سے 10 طلبہ', duration: '1 سے 2 گھنٹے', recitation: 'زیادہ تلاوت کا وقت اور قریبی توجہ', features: ['فیس اور انفرادی وقت کے درمیان بہترین توازن', 'تلاوت اور تجوید کی براہِ راست اصلاح', 'طالب علم یا سرپرست کے ساتھ ہفتہ وار رابطہ'] },
      id: { name: 'Halaqah Kelompok', badge: 'Paling diminati', students: '5–10 peserta', duration: '1–2 jam', recitation: 'Durasi setor lebih panjang & bimbingan dekat', features: ['Keseimbangan terbaik antara biaya dan waktu setor', 'Koreksi langsung tilawah dan hukum tajwid', 'Tindak lanjut mingguan bersama peserta atau orang tua'] },
      ms: { name: 'Halaqah Kumpulan', badge: 'Paling popular', students: '5–10 pelajar', duration: '1–2 jam', recitation: 'Masa bacaan lebih panjang & bimbingan rapat', features: ['Imbangan terbaik antara harga dan masa bacaan individu', 'Pembetulan bacaan dan tajwid secara langsung', 'Susulan mingguan bersama pelajar atau ibu bapa'] },
      ku: { name: 'بازنەی بەکۆمەڵ', badge: 'زۆرترین خواست', students: '٥ تا ١٠ قوتابی', duration: '١ تا ٢ کاتژمێر', recitation: 'کاتی خوێندنەوەی درێژتر و بەدواداچوونی نزیکتر', features: ['باشترین هاوسەنگی نێوان نرخ و کاتی خوێندنەوەی تاک', 'ڕاستکردنەوەی ڕاستەوخۆی خوێندنەوە و تەجوید', 'بەدواداچوونی هەفتانە لەگەڵ بەخێوکار یان قوتابی'] },
    },
  },
  {
    id: 'focused',
    price: 35,
    i18n: {
      ar: { name: 'الحلقة المركزة', badge: 'متابعة أقوى', students: 'من 3 إلى 5 طلاب', duration: 'ساعة ونصف', recitation: 'تركيز عالٍ للحفظ والمراجعة المكثفة', features: ['مجموعة صغيرة جداً بتركيز مضاعف لكل طالب', 'مناسبة لخطة الحفظ السريع والمراجعة الكبرى', 'تقييم تفصيلي بعد كل حصة'] },
      en: { name: 'Focused Circle', badge: 'High focus', students: '3–5 students', duration: '90 minutes', recitation: 'High focus for intensive Hifz & review', features: ['Very small group with doubled attention per learner', 'Ideal for accelerated Hifz and major review', 'Detailed evaluation after every session'] },
      fr: { name: 'Cercle ciblé', badge: 'Suivi renforcé', students: '3 à 5 élèves', duration: '90 minutes', recitation: 'Haute attention pour Hifz et révision intensive', features: ['Très petit groupe avec attention doublée par élève', 'Idéal pour un Hifz accéléré et de grandes révisions', 'Évaluation détaillée après chaque séance'] },
      de: { name: 'Fokuskreis', badge: 'Hohe Intensität', students: '3–5 Lernende', duration: '90 Minuten', recitation: 'Hohe Aufmerksamkeit für intensiven Hifz', features: ['Sehr kleine Gruppe mit doppelter Aufmerksamkeit', 'Ideal für schnelleres Auswendiglernen & große Wiederholung', 'Detaillierte Bewertung nach jeder Einheit'] },
      tr: { name: 'Odaklı Halka', badge: 'Güçlü takip', students: '3–5 öğrenci', duration: '90 dakika', recitation: 'Yoğun hıfz ve tekrar için yüksek odak', features: ['Her öğrenciye iki kat ilgi sunan çok küçük grup', 'Hızlı ezber ve kapsamlı tekrar için ideal', 'Her ders sonrası ayrıntılı değerlendirme'] },
      ur: { name: 'مرکوز حلقہ', badge: 'گہری توجہ', students: '3 سے 5 طلبہ', duration: 'ڈیڑھ گھنٹہ', recitation: 'تیز حفظ اور بڑی دہرائی کے لیے بھرپور توجہ', features: ['انتہائی چھوٹا گروپ اور ہر طالب علم پر دگنی توجہ', 'تیز رفتار حفظ اور بڑی دہرائی کے لیے موزوں', 'ہر کلاس کے بعد تفصیلی جائزہ'] },
      id: { name: 'Halaqah Terfokus', badge: 'Fokus tinggi', students: '3–5 peserta', duration: '90 menit', recitation: 'Fokus tinggi untuk hafalan & murajaah intensif', features: ['Kelompok sangat kecil dengan perhatian ganda', 'Ideal untuk percepatan hafalan dan murajaah besar', 'Evaluasi terperinci setelah setiap sesi'] },
      ms: { name: 'Halaqah Berfokus', badge: 'Fokus tinggi', students: '3–5 pelajar', duration: '90 minit', recitation: 'Tumpuan tinggi untuk hafazan & ulangan intensif', features: ['Kumpulan sangat kecil dengan perhatian berganda', 'Sesuai untuk hafazan pantas dan ulangan besar', 'Penilaian terperinci selepas setiap sesi'] },
      ku: { name: 'بازنەی چڕ', badge: 'بەدواداچوونی بەهێزتر', students: '٣ تا ٥ قوتابی', duration: 'کاتژمێر و نیوێک', recitation: 'تەرکیزی بەرز بۆ لەبەرکردن و پێداچوونەوەی چڕ', features: ['گرووپێکی زۆر بچووک بە تەرکیزی دوو هێندە بۆ هەر قوتابییەک', 'گونجاو بۆ پلاتفۆرمی حیفزی خێرا و پێداچوونەوەی گەورە', 'هەڵسەنگاندنی ورد دوای هەر وانەیەک'] },
    },
  },
  {
    id: 'mini',
    price: 50,
    i18n: {
      ar: { name: 'الحلقة المصغرة', badge: 'شبه فردي', students: 'من 2 إلى 3 طلاب', duration: 'ساعة أو أقل', recitation: 'اهتمام شبه فردي وخطة دقيقة', features: ['طالبان أو ثلاثة فقط مع المعلم أو المعلمة', 'مناسبة للإخوة أو الأصدقاء في نفس المستوى', 'مرونة عالية في وتيرة الحفظ والتلقين'] },
      en: { name: 'Mini Circle', badge: 'Semi-private', students: '2–3 students', duration: 'Up to 60 minutes', recitation: 'Near-private coaching & tailored pacing', features: ['Only 2–3 learners with the instructor', 'Great for siblings or peers at the same level', 'High flexibility in memorization pacing'] },
      fr: { name: 'Mini-cercle', badge: 'Semi-privé', students: '2 à 3 élèves', duration: 'Jusqu’à 60 min', recitation: 'Accompagnement quasi individuel & rythme précis', features: ['Seulement 2 à 3 élèves avec l’enseignant', 'Idéal pour frères, sœurs ou proches du même niveau', 'Grande souplesse dans le rythme'] },
      de: { name: 'Mini-Kreis', badge: 'Halbprivat', students: '2–3 Lernende', duration: 'Bis zu 60 Min.', recitation: 'Nahezu individuelles Coaching & eigenes Tempo', features: ['Nur 2–3 Lernende mit der Lehrkraft', 'Ideal für Geschwister oder Freunde auf gleichem Stand', 'Hohe Flexibilität beim Lerntempo'] },
      tr: { name: 'Mini Halka', badge: 'Yarı özel', students: '2–3 öğrenci', duration: 'En fazla 60 dk', recitation: 'Yarı bireysel ilgi ve hassas planlama', features: ['Hocayla yalnızca 2 veya 3 öğrenci', 'Aynı seviyedeki kardeş veya arkadaşlar için ideal', 'Ezber ve telkin hızında yüksek esneklik'] },
      ur: { name: 'مختصر حلقہ', badge: 'نیم انفرادی', students: '2 سے 3 طلبہ', duration: 'ایک گھنٹہ یا کم', recitation: 'تقریباً انفرادی توجہ اور دقیق منصوبہ بندی', features: ['استاد کے ساتھ صرف دو یا تین طلبہ', 'ایک ہی سطح کے بہن بھائیوں یا دوستوں کے لیے بہترین', 'حفظ و تلقین کی رفتار میں بھرپور لچک'] },
      id: { name: 'Halaqah Mini', badge: 'Semi-privat', students: '2–3 peserta', duration: 'Hingga 60 menit', recitation: 'Bimbingan nyaris privat & ritme terukur', features: ['Hanya 2–3 peserta bersama pengajar', 'Cocok untuk saudara atau teman selevel', 'Fleksibilitas tinggi dalam ritme hafalan'] },
      ms: { name: 'Halaqah Mini', badge: 'Separa peribadi', students: '2–3 pelajar', duration: 'Sehingga 60 minit', recitation: 'Bimbingan hampir peribadi & rentak tersendiri', features: ['Hanya 2–3 pelajar bersama guru', 'Sesuai untuk adik-beradik atau rakan setaraf', 'Fleksibiliti tinggi dalam kadar hafazan'] },
      ku: { name: 'بازنەی بچووککراوە', badge: 'نیمچە تاکەکەسی', students: '٢ تا ٣ قوتابی', duration: 'کاتژمێرێک یان کەمتر', recitation: 'گرنگیپێدانی نیمچە تاکەکەسی و پلاتفۆرمی ورد', features: ['تەنها دوو یان سێ قوتابی لەگەڵ مامۆستا', 'گونجاو بۆ خوشک و برا یان هاوڕێیان لە هەمان ئاستدا', 'نەرمییەکی بەرز لە خێرایی لەبەرکردن و تەلقیندا'] },
    },
  },
  {
    id: 'private',
    from: true,
    price: 100,
    i18n: {
      ar: { name: 'الحصة الفردية', badge: 'أعلى متابعة', students: 'طالب واحد فقط', duration: 'ساعة أو أقل', recitation: 'الوقت بالكامل مخصص لك وحدك', features: ['خطة مخصصة بالكامل (حفظ، تجويد، أو إجازة بالسند)', 'أعلى مرونة في اختيار المواعيد', 'تركيز كامل من المعلم طوال وقت الحصة'] },
      en: { name: 'Private Session', badge: '1-on-1 private', students: '1 student (1-on-1)', duration: 'Up to 60 minutes', recitation: '100% of the session dedicated to you', features: ['Fully personalized plan (Hifz, Tajweed, or Sanad Ijazah)', 'Maximum scheduling flexibility', 'Undivided instructor attention throughout the session'] },
      fr: { name: 'Séance individuelle', badge: '1-à-1 privé', students: '1 élève (1-à-1)', duration: 'Jusqu’à 60 min', recitation: '100 % de la séance dédiée à vous', features: ['Programme sur mesure (Hifz, Tajweed ou Ijazah)', 'Souplesse maximale des horaires', 'Attention exclusive de l’enseignant'] },
      de: { name: 'Einzelstunde', badge: '1-zu-1 privat', students: '1 Lernender (1-zu-1)', duration: 'Bis zu 60 Min.', recitation: '100 % der Unterrichtszeit nur für Sie', features: ['Vollständig individueller Plan (Hifz, Tajweed oder Ijazah)', 'Maximale Terminflexibilität', 'Ungeteilte Aufmerksamkeit der Lehrkraft'] },
      tr: { name: 'Birebir Özel Ders', badge: 'En yüksek takip', students: 'Tek öğrenci (1-1)', duration: 'En fazla 60 dk', recitation: 'Ders süresinin tamamı yalnızca size ayrılır', features: ['Tamamen kişiye özel plan (Hıfz, Tecvid veya İcazet)', 'Saat seçiminde en yüksek esneklik', 'Ders boyunca hocadan kesintisiz odak'] },
      ur: { name: 'انفرادی کلاس', badge: 'مکمل ذاتی توجہ', students: 'صرف 1 طالب علم', duration: 'ایک گھنٹہ یا کم', recitation: 'پورا وقت مکمل طور پر آپ کے لیے مختص', features: ['مکمل ذاتی منصوبہ (حفظ، تجوید یا سندِ اجازت)', 'اوقات کے انتخاب میں مکمل لچک', 'پوری کلاس میں استاد کی یکسو توجہ'] },
      id: { name: 'Sesi Privat 1-on-1', badge: 'Pendampingan penuh', students: '1 peserta (1-on-1)', duration: 'Hingga 60 menit', recitation: '100% waktu sesi khusus untuk Anda', features: ['Rencana sepenuhnya personal (Hifz, Tajwid, atau Ijazah)', 'Fleksibilitas jadwal maksimal', 'Perhatian penuh pengajar sepanjang sesi'] },
      ms: { name: 'Sesi Peribadi 1-on-1', badge: 'Pemantauan penuh', students: '1 pelajar (1-on-1)', duration: 'Sehingga 60 minit', recitation: '100% masa sesi khusus untuk anda', features: ['Pelan peribadi sepenuhnya (Hifz, Tajwid atau Ijazah)', 'Fleksibiliti jadual maksimum', 'Tumpuan penuh guru sepanjang sesi'] },
      ku: { name: 'وانەی تاکەکەسی', badge: 'بەرزترین بەدواداچوون', students: 'تەنها ١ قوتابی', duration: 'کاتژمێرێک یان کەمتر', recitation: 'تەواوی کاتەکە تەنها بۆ تۆ تەرخان کراوە', features: ['پلاتفۆرمی تایبەتی تەواو (حیفز، تەجوید، یان ئیجازە)', 'بەرزترین نەرمی لە هەڵبژاردنی کاتەکاندا', 'تەرکیزی تەواوی مامۆستا بە درێژایی کاتی وانە'] },
    },
  },
];

const SESSION_PACKS = [4, 8, 12, 24];
const SECTION_KEYS = ['general', 'women'];
const PLAN_KEYS = CALCULATOR_PLANS.map((plan) => plan.id);

export default function PricingCalculatorSection() {
  const { locale, isRTL } = useI18n();
  const { displayPrice } = useMarket();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = pickLocale(CALCULATOR_COPY, locale, isRTL);

  const [section, setSection] = useState('general');
  const [selectedPlanId, setSelectedPlanId] = useState('group');
  const [sessionCount, setSessionCount] = useState(8);

  const activePlan = CALCULATOR_PLANS.find((plan) => plan.id === selectedPlanId) || CALCULATOR_PLANS[1];
  const activePlanCopy = pickLocale(activePlan.i18n, locale, isRTL);
  const totalAmount = activePlan.price * sessionCount;
  const pacingNote = copy.pacing?.[sessionCount] || '';

  const checkoutTarget = `/plans?section=${encodeURIComponent(section)}&plan=${encodeURIComponent(activePlan.id)}&sessions=${sessionCount}#plan-${activePlan.id}`;
  const minFormattedPrice = displayPrice(10, 'EGP');

  const sessionWord = (count) => {
    if (locale === 'ar') return count === 12 ? copy.sessionSingular : copy.sessionPlural;
    return count === 1 ? copy.sessionSingular : copy.sessionPlural;
  };

  return (
    <section className="wn-home-section wn-home-section--white" id="pricing-calculator">
      <div className="page-container">
        <div className="wn-approved-section-heading">
          <span className="wn-approved-eyebrow">
            <Calculator size={14} aria-hidden="true" />
            {copy.eyebrow}
          </span>
          <h2>{copy.title}</h2>
          <p>{copy.lead.replace('{minPrice}', minFormattedPrice)}</p>
        </div>

        <div className="wn-calc-shell">
          <div className="wn-calc-controls">
            {/* 1. Section Selector */}
            <div className="wn-calc-group">
              <span className="wn-calc-label">{copy.step1}</span>
              <div className="wn-calc-section-toggle" role="group" aria-label={copy.sectionAria}>
                <button
                  type="button"
                  aria-pressed={section === 'general'}
                  aria-controls="wn-calc-summary-panel"
                  onClick={() => setSection('general')}
                  onKeyDown={(event) => handleRovingKeyDown({
                    event,
                    keys: SECTION_KEYS,
                    currentKey: 'general',
                    onSelect: setSection,
                    isRTL,
                  })}
                  className={'wn-calc-section-btn' + (section === 'general' ? ' is-active' : '')}
                >
                  <Users size={17} aria-hidden="true" />
                  <div>
                    <strong>{copy.menTitle}</strong>
                    <small>{copy.menSub}</small>
                  </div>
                </button>
                <button
                  type="button"
                  aria-pressed={section === 'women'}
                  aria-controls="wn-calc-summary-panel"
                  onClick={() => setSection('women')}
                  onKeyDown={(event) => handleRovingKeyDown({
                    event,
                    keys: SECTION_KEYS,
                    currentKey: 'women',
                    onSelect: setSection,
                    isRTL,
                  })}
                  className={'wn-calc-section-btn wn-calc-section-btn--women' + (section === 'women' ? ' is-active' : '')}
                >
                  <Heart size={17} aria-hidden="true" />
                  <div>
                    <strong>{copy.womenTitle}</strong>
                    <small>{copy.womenSub}</small>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Plan Selector */}
            <div className="wn-calc-group">
              <span className="wn-calc-label">{copy.step2}</span>
              <div className="wn-calc-plans-grid" role="radiogroup" aria-label={copy.planAria}>
                {CALCULATOR_PLANS.map((plan) => {
                  const isSelected = plan.id === activePlan.id;
                  const planCopy = pickLocale(plan.i18n, locale, isRTL);
                  return (
                    <button
                      type="button"
                      key={plan.id}
                      role="radio"
                      aria-checked={isSelected}
                      aria-controls="wn-calc-summary-panel"
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => setSelectedPlanId(plan.id)}
                      onKeyDown={(event) => handleRovingKeyDown({
                        event,
                        keys: PLAN_KEYS,
                        currentKey: plan.id,
                        onSelect: setSelectedPlanId,
                        isRTL,
                      })}
                      className={
                        'wn-calc-plan-option'
                        + (isSelected ? ' is-selected' : '')
                        + (plan.featured ? ' is-featured' : '')
                      }
                    >
                      <div className="wn-calc-plan-option__head">
                        <span className="wn-calc-plan-option__badge">
                          {plan.featured ? <Crown size={12} aria-hidden="true" /> : null}
                          {planCopy.badge}
                        </span>
                        <strong className="wn-calc-plan-option__price">
                          {plan.from ? copy.fromPrefix : ''}
                          {displayPrice(plan.price, 'EGP')} <small>{copy.perSessionUnit}</small>
                        </strong>
                      </div>
                      <h4>{planCopy.name}</h4>
                      <span className="wn-calc-plan-option__meta">{planCopy.students}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Session Pack Selector */}
            <div className="wn-calc-group">
              <span className="wn-calc-label">{copy.step3}</span>
              <div className="wn-calc-packs" role="radiogroup" aria-label={copy.packsAria}>
                {SESSION_PACKS.map((count) => {
                  const active = sessionCount === count;
                  return (
                    <button
                      type="button"
                      key={count}
                      role="radio"
                      aria-checked={active}
                      aria-controls="wn-calc-summary-panel"
                      tabIndex={active ? 0 : -1}
                      onClick={() => setSessionCount(count)}
                      onKeyDown={(event) => handleRovingKeyDown({
                        event,
                        keys: SESSION_PACKS,
                        currentKey: count,
                        onSelect: setSessionCount,
                        isRTL,
                      })}
                      className={'wn-calc-pack-btn' + (active ? ' is-active' : '')}
                    >
                      <strong>{count}</strong>
                      <span>{sessionWord(count)}</span>
                    </button>
                  );
                })}
              </div>
              {pacingNote && (
                <div className="wn-calc-pacing-hint">
                  <CalendarRange size={15} aria-hidden="true" />
                  <span>{pacingNote}</span>
                </div>
              )}
            </div>
          </div>

          {/* Live Summary Card */}
          <aside id="wn-calc-summary-panel" className="wn-calc-summary" aria-live="polite">
            <div className="wn-calc-summary__header">
              <span className="wn-calc-summary__pill">
                <Sparkles size={13} aria-hidden="true" />
                {section === 'women' ? copy.womenPill : copy.menPill}
              </span>
              <h3>{activePlanCopy.name}</h3>
              <p>{activePlanCopy.recitation}</p>
            </div>

            <div className="wn-calc-summary__pricing">
              <div className="wn-calc-summary__row">
                <span>{copy.pricePerSessionLabel}</span>
                <strong>
                  {activePlan.from ? copy.fromPrefix : ''}
                  {displayPrice(activePlan.price, 'EGP')}
                </strong>
              </div>
              <div className="wn-calc-summary__row">
                <span>{copy.selectedSessionsLabel}</span>
                <strong>
                  {sessionCount} {sessionWord(sessionCount)}
                </strong>
              </div>
              <div className="wn-calc-summary__total">
                <span>{copy.packageTotalLabel}</span>
                <strong>
                  {activePlan.from ? copy.fromPrefix : ''}
                  {displayPrice(totalAmount, 'EGP')}
                </strong>
              </div>
            </div>

            <div className="wn-calc-summary__specs">
              <span>
                <Users size={15} aria-hidden="true" />
                {activePlanCopy.students}
              </span>
              <span>
                <Clock3 size={15} aria-hidden="true" />
                {activePlanCopy.duration}
              </span>
            </div>

            <ul className="wn-calc-summary__features">
              {activePlanCopy.features.map((feature) => (
                <li key={feature}>
                  <Check size={15} aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="wn-calc-summary__actions">
              <LocalizedLink
                to={checkoutTarget}
                locale={locale}
                onMouseEnter={() => prefetchRoute('/plans')}
                className="wn-btn wn-btn--light wn-btn--lg wn-btn--block"
              >
                <span>{copy.continueCta}</span>
                <ArrowIcon size={17} className="wn-btn__arrow" aria-hidden="true" />
              </LocalizedLink>
              <LocalizedLink
                to="/free-trial"
                locale={locale}
                onMouseEnter={() => prefetchRoute('/free-trial')}
                className="wn-btn wn-btn--outline-light wn-btn--block"
              >
                <span>{copy.trialCta}</span>
              </LocalizedLink>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

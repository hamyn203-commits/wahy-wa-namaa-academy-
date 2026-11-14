import { useI18n } from '../../../i18n';
import { Star, Quote, Heart } from 'lucide-react';

export default function TestimonialsSection() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';

  const reviews = [
    {
      name: isAr ? 'أبو عبد الله — لندن، بريطانيا' : 'Abu Abdullah — London, UK',
      role: isAr ? 'ولي أمر لطالبين (8 و 11 سنة)' : 'Father of 2 Students (Ages 8 & 11)',
      track: isAr ? 'مسار براعم النماء' : 'Bara’em Al-Namaa Track',
      text: isAr
        ? '«كنا نخشى على لغة أبنائنا وهويتهم في الغربة. بفضل الله ثم أسلوب معلمي وحي ونماء الصبور، لم يحفظ طفلاي فقط بل تعلما الأدب والبر، وأصبحا ينتظران موعد الحصة بشوق لا يوصف.»'
        : '“Living in the UK, we worried about our children losing their Arabic and Islamic identity. Wahy Wa Namaa tutors didn’t just teach them verses; they nurtured character and reverence for the Quran.”',
      rating: 5,
    },
    {
      name: isAr ? 'م. طارق السعيد — الرياض، السعودية' : 'Eng. Tariq Al-Saeed — Riyadh, KSA',
      role: isAr ? 'مهندس برمجيات (34 سنة)' : 'Software Engineer (Age 34)',
      track: isAr ? 'مسار الكبار والموظفين' : 'Professionals Evening Track',
      text: isAr
        ? '«كنت أظن أن مشاغل العمل تمنعني من الحفظ المنتظم. مرونة المواعيد والمتابعة اللطيفة ساعدتني على إتمام 7 أجزاء متقنة خلال عام واحد. القرآن أحدث بركة حقيقية في يومي وسلامي النفسي.»'
        : '“I thought work demands would prevent consistent memorization. The adaptive timings and gentle pacing enabled me to master 7 Juz within a year. A true blessing and inner peace in my life.”',
      rating: 5,
    },
    {
      name: isAr ? 'مريم إبراهيم — القاهرة، مصر' : 'Maryam Ibrahim — Cairo, Egypt',
      role: isAr ? 'طالبة جامعية خاتمة للقرآن' : 'University Graduate',
      track: isAr ? 'مسار الإجازة بالسند المتصل' : 'Sanad & Ijazah Track',
      text: isAr
        ? '«الدقة في ضبط مخارج الحروف والوقف والابتداء مع شيختي كانت استثنائية. نيل السند المتصل برواية حفص كان أعظم شرف في حياتي. الأكاديمية لا تتهاون في أمانة النقل القرآني.»'
        : '“The phonetic rigor and devotion to oral precision with my Sheikha was exceptional. Attaining unbroken Sanad in Hafs was the greatest honor of my life. True custodians of divine revelation.”',
      rating: 5,
    },
    {
      name: isAr ? 'عمر جنكيز — تورونتو، كندا' : 'Omar Cengiz — Toronto, Canada',
      role: isAr ? 'طالب بمسار غير الناطقين بالعربية' : 'International Student',
      track: isAr ? 'مسار اللغات العالمي' : 'Non-Arabic Quranic Track',
      text: isAr
        ? '«بدأت وأنا لا أعرف قراءة الحروف العربية. خلال أشهر قليلة، استطعت بفضل الله ثم توجيه الشيخ بالإنجليزية أن أقرأ سورة البقرة بتجويد سليم. تجربة غيّرت حياتي بالكامل.»'
        : '“I began unable to read a single Arabic letter. Within months of bilingual coaching, I can now recite Surah Al-Baqarah with accurate Tajweed. A truly life-altering journey.”',
      rating: 5,
    },
  ];

  return (
    <section className="py-20 lg:py-28 bg-[var(--wn-ivory)] relative overflow-hidden border-b border-[#e9e3d5]" id="testimonials">
      <div className="page-container relative z-10">
        
        {/* ترويسة القسم */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-white text-[var(--wn-forest)] border border-[var(--wn-gold)]/40 mb-4 shadow-2xs">
            <Heart size={14} className="text-rose-600 fill-rose-600" />
            <span>{isAr ? 'أثر القرآن في حياة الدارسين' : 'Living Impact & Testimonials'}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[var(--wn-forest)] tracking-tight mb-5">
            {isAr ? 'آراء وتجارب حقيقية' : 'Authentic Stories of Quranic Growth'}
          </h2>

          <p className="text-base sm:text-lg text-[var(--wn-stone)] leading-relaxed font-normal">
            {isAr
              ? 'شهادات واقعية من أولياء الأمور والطلاب الذين اختبروا أثر النماء الروحي والفكري مع أكاديمية وحي ونماء.'
              : 'Real words from families and students who experienced spiritual flourishing and character transformation.'}
          </p>
        </div>

        {/* شبكة الشهادات */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {reviews.map((rev, idx) => (
            <div
              key={idx}
              className="relative rounded-2xl bg-white border border-[#e8dfce] p-8 shadow-xs hover:shadow-xl hover:border-[var(--wn-gold)] transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* علامة الاقتباس والنجوم */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: rev.rating }).map((_, sIdx) => (
                      <Star key={sIdx} size={15} className="fill-amber-500 text-amber-500" />
                    ))}
                  </div>
                  <Quote size={24} className="text-[var(--wn-gold)]/50" />
                </div>

                <p className="text-sm sm:text-base text-[var(--wn-charcoal)] leading-relaxed italic mb-6 font-medium">
                  {rev.text}
                </p>
              </div>

              {/* صاحب الشهادة ومساره */}
              <div className="pt-4 border-t border-[#f0ebd9] flex items-center justify-between">
                <div>
                  <div className="text-sm font-black text-[var(--wn-forest)]">
                    {rev.name}
                  </div>
                  <div className="text-xs text-[var(--wn-stone)]">
                    {rev.role}
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-[#f6f0e4] text-[var(--wn-forest)] border border-[var(--wn-gold)]/30">
                  {rev.track}
                </span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

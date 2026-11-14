import { useI18n } from '../../../i18n';
import { BookOpen, Award, Sprout, Sparkles, CheckCircle } from 'lucide-react';

export default function PhilosophySection() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';

  const pillars = [
    {
      step: '01',
      title: isAr ? 'نتعلم القرآن' : 'Learn the Quran',
      subtitle: isAr ? 'فهم وتلقٍّ سليم' : 'Sound Comprehension & Transmission',
      description: isAr
        ? 'التلقي الصحيح بالمشافهة على أيدي كبار القراء، وتصحيح مخارج الحروف وأحكام التجويد، مع فقه المعاني وتدبر الآيات قبل الحفظ لتكون التلاوة ببصيرة.'
        : 'Direct oral transmission from accredited masters, accurate phonetics, tajweed rules, and understanding meanings before committing to memory.',
      icon: BookOpen,
      highlights: [
        isAr ? 'تصحيح المخارج والمشافهة' : 'Oral correction & articulation',
        isAr ? 'فهم غريب القرآن والمعاني' : 'Comprehending Quranic vocabulary',
        isAr ? 'التأسيس اللغوي السليم' : 'Sound Arabic foundation',
      ],
      badgeColor: 'bg-emerald-50 text-[var(--wn-emerald)] border-emerald-200',
    },
    {
      step: '02',
      title: isAr ? 'نحفظه' : 'Memorize It',
      subtitle: isAr ? 'حفظ ومراجعة وإتقان' : 'Steadfast Retention & Mastery',
      description: isAr
        ? 'منهجية علمية تراكمية تجمع بين الحفظ الجديد، والمراجعة الصغرى اليومية، والمراجعة الكبرى الأسبوعية، وضبط متشابهات القرآن حتى يستقر في الصدر كالجبال الرواسي.'
        : 'A systematic cumulative method combining daily new memorization, short-cycle reviews, weekly major consolidations, and mutashabihat precision.',
      icon: Award,
      highlights: [
        isAr ? 'خطط حفظ فردية مدروسة' : 'Personalized memorization plans',
        isAr ? 'مراجعة تراكمية مستمرة' : 'Continuous cumulative reviews',
        isAr ? 'ضبط المتشابهات اللفظية' : 'Mutashabihat mastery',
      ],
      badgeColor: 'bg-amber-50 text-[var(--wn-gold-dark)] border-amber-200',
    },
    {
      step: '03',
      title: isAr ? 'وننمو به' : 'Grow Through It',
      subtitle: isAr ? 'أثر وسلوك في الإنسان' : 'Living Character & Moral Growth',
      description: isAr
        ? 'القرآن ليس مجرد أصوات تُردد، بل نور يزكي الروح ويهذب السلوك. نربط الآيات بالواقع التربوي ليكون حافظ القرآن قرآناً يمشي على الأرض في بره وأمانته وعطائه.'
        : 'The Quran is not merely words chanted, but a living light purifying the soul. We anchor divine verses in daily ethics so the student flourishes in integrity, gratitude, and moral excellence.',
      icon: Sprout,
      highlights: [
        isAr ? 'تزكية النفس وبناء السلوك' : 'Soul purification & character building',
        isAr ? 'ربط الحفظ بالعمل الصالح' : 'Harmonizing memory with good deeds',
        isAr ? 'الأثر الممتد في الأسرة والمجتمع' : 'Lasting positive family and community impact',
      ],
      badgeColor: 'bg-stone-100 text-[var(--wn-forest)] border-stone-300',
    },
  ];

  return (
    <section className="py-20 lg:py-28 bg-[#fdfcf9] relative overflow-hidden border-b border-[#e9e3d5]" id="philosophy">
      {/* عناصر خلفية هندسية رقيقة */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--wn-gold)]/50 to-transparent" />
      
      <div className="page-container relative z-10">
        
        {/* ترويسة القسم */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-[#f3ede1] text-[var(--wn-forest)] border border-[var(--wn-gold)]/40 mb-4">
            <Sparkles size={14} className="text-[var(--wn-gold)]" />
            <span>{isAr ? 'فلسفة ورسالة الأكاديمية' : 'Our Institutional Philosophy'}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[var(--wn-forest)] tracking-tight mb-5">
            {isAr ? 'فلسفتنا في بناء الإنسان القرآني' : 'Our Philosophy in Nurturing the Quranic Persona'}
          </h2>

          <p className="text-base sm:text-lg text-[var(--wn-stone)] leading-relaxed font-normal">
            {isAr
              ? '«القرآن مصدر التعلم، والحفظ وسيلة الإتقان، والنمو هو أثر الرحلة في الإنسان.» ثلاثية محكمة تنظم مسار كل طالب يلتحق بوحي ونماء.'
              : '"The Quran is the source of learning, memorization is the path to mastery, and growth is the fruit of the journey in man." A triadic blueprint guiding every student.'}
          </p>
        </div>

        {/* شبكة الأركان الثلاثة */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pillars.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="group relative rounded-2xl bg-white border border-[#e8dfce] p-8 shadow-xs hover:shadow-xl hover:border-[var(--wn-gold)] transition-all duration-300 flex flex-col justify-between"
              >
                {/* علامة الخط العلوي */}
                <div className="absolute top-0 inset-x-0 h-1 bg-transparent group-hover:bg-gradient-to-r from-[var(--wn-forest)] via-[var(--wn-emerald)] to-[var(--wn-gold)] rounded-t-2xl transition-all" />

                <div>
                  {/* رقم الخطوة والأيقونة */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 rounded-xl bg-[var(--wn-ivory)] border border-[#e5decb] flex items-center justify-center text-[var(--wn-forest)] group-hover:bg-[var(--wn-forest)] group-hover:text-[var(--wn-gold)] transition-colors duration-300">
                      <Icon size={26} strokeWidth={1.75} />
                    </div>
                    <span className="text-3xl font-black text-[#e8dfce] font-mono group-hover:text-[var(--wn-gold)]/60 transition-colors">
                      {item.step}
                    </span>
                  </div>

                  {/* الشارة والعنوان */}
                  <div className="mb-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${item.badgeColor} mb-2`}>
                      {item.subtitle}
                    </span>
                    <h3 className="text-2xl font-black text-[var(--wn-forest)] tracking-tight">
                      {item.title}
                    </h3>
                  </div>

                  {/* الوصف */}
                  <p className="text-sm sm:text-base text-[var(--wn-stone)] leading-relaxed mb-6 font-normal">
                    {item.description}
                  </p>
                </div>

                {/* المرتكزات التفصيلية */}
                <div className="pt-5 border-t border-[#f0ebd9] space-y-2.5">
                  {item.highlights.map((hl, hIdx) => (
                    <div key={hIdx} className="flex items-center gap-2 text-xs sm:text-sm text-[var(--wn-charcoal)] font-semibold">
                      <CheckCircle size={15} className="text-[var(--wn-emerald)] shrink-0" />
                      <span>{hl}</span>
                    </div>
                  ))}
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}

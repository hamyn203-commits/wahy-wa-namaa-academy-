import { useState } from 'react';
import { useI18n } from '../../i18n';
import { motion } from 'framer-motion';
import {
  Send,
  CheckCircle,
  MessageCircle,
  BookOpenCheck,
  Handshake,
  Sparkles,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';
import '../../styles/public-experience.css';

export default function Contact() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const toast = useToast();
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (event) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await api.post('/api/contact', formData);
      setIsSubmitted(true);
      toast.success(isAr ? 'تم إرسال رسالتك بنجاح! سنتواصل معك قريباً.' : 'Your message has been sent!');
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
      setTimeout(() => setIsSubmitted(false), 5000);
    } catch {
      toast.error(isAr ? 'تعذر إرسال الرسالة، حاول لاحقًا' : 'Failed to send message. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickSubjects = isAr
    ? [
        'استفسار عن الباقات والمسارات',
        'حجز الحصة التجريبية المجانية',
        'القسم النسائي وتأسيس الأطفال',
        'الدعم الفني والحساب',
        'شراكات ومؤسسات تعليمية',
      ]
    : [
        'Plans & Learning Tracks',
        'Free Trial Booking',
        'Women & Kids Section',
        'Account & Technical Support',
        'Educational Partnerships',
      ];

  const helpCards = [
    {
      icon: BookOpenCheck,
      title: isAr ? 'البرامج والمسارات' : 'Programs and paths',
      text: isAr ? 'اسأل عن المسار الأنسب للمستوى والهدف.' : 'Ask which path best fits your level and goal.',
    },
    {
      icon: MessageCircle,
      title: isAr ? 'الدعم والمساعدة' : 'Support and help',
      text: isAr
        ? 'لو واجهتك مشكلة في الحساب أو تجربة المنصة، اشرحها لنا هنا.'
        : 'If you have an account or platform issue, describe it here.',
    },
    {
      icon: Handshake,
      title: isAr ? 'الشراكات والتعاون' : 'Partnerships',
      text: isAr
        ? 'للمبادرات التعليمية والمؤسسات الراغبة في التعاون.'
        : 'For educational initiatives and organizations interested in collaboration.',
    },
  ];

  return (
    <>
      <SEOHead
        page={{
          title: isAr ? 'تواصل معنا' : 'Contact Us',
          description: isAr ? 'تواصل مع فريق أكاديمية وحي ونماء.' : 'Contact the Wahy Wa Namaa Academy team.',
          url: '/contact',
          type: 'website',
        }}
      />
      <GlobalHeader />

      <main className="wn-public-shell">
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow">
                <Sparkles size={14} /> {isAr ? 'تواصل مع الأكاديمية' : 'CONTACT THE ACADEMY'}
              </span>
              <h1>{isAr ? 'كيف نقدر نساعدك؟' : 'How can we help?'}</h1>
              <p>
                {isAr
                  ? 'أرسل رسالتك من النموذج، وسنستخدم بيانات التواصل التي تكتبها أنت للرد عليك.'
                  : 'Send your message through the form. We will use the contact details you provide to respond.'}
              </p>
            </div>
            <div className="wn-public-hero__art" aria-hidden="true">
              <div className="wn-public-orbit" />
              <div className="wn-public-orbit__core">
                <MessageCircle size={46} strokeWidth={1.25} />
              </div>
            </div>
          </div>
        </section>

        <section className="page-container wn-public-copy-section">
          <div className="wn-public-feature-grid mb-6">
            {helpCards.map(({ icon: Icon, title, text }) => (
              <article key={title} className="wn-public-feature-card">
                <span>
                  <Icon size={21} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>

          <div className="wn-public-form-layout">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="wn-public-message-card"
            >
              <h2>{isAr ? 'أرسل لنا رسالة' : 'Send us a message'}</h2>
              <p className="mt-1 text-sm text-[var(--wn-text-secondary)]">
                {isAr ? 'اختر موضوع رسالتك بنقرة سريعة أو اكتب التفاصيل بوضوح.' : 'Pick a quick topic or write your inquiry in detail.'}
              </p>

              {/* Quick Subject Selector Pills */}
              <div className="mt-4">
                <span className="block text-xs font-bold text-[var(--wn-emerald-deep)] mb-2">
                  {isAr ? 'اختيار سريع للموضوع:' : 'Quick subject selection:'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {quickSubjects.map((topic) => {
                    const selected = formData.subject === topic;
                    return (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, subject: topic }))}
                        className={selected ? 'wn-quick-spec-pill is-active' : 'wn-quick-spec-pill'}
                      >
                        {topic}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isSubmitted ? (
                <div className="mt-5 p-4 rounded-xl border border-emerald-200 bg-emerald-50 flex items-start gap-3">
                  <CheckCircle className="text-emerald-700 shrink-0" size={20} />
                  <div>
                    <strong className="text-emerald-900">{isAr ? 'تم إرسال رسالتك' : 'Message sent'}</strong>
                    <p className="text-xs text-emerald-700 mt-1">
                      {isAr ? 'تم استلام طلبك بنجاح.' : 'Your request was received successfully.'}
                    </p>
                  </div>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="grid gap-4 mt-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--wn-emerald-deep)] mb-2">
                      {isAr ? 'الاسم الكامل' : 'Full name'} *
                    </label>
                    <input
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      placeholder={isAr ? 'اسمك الكامل' : 'Your full name'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--wn-emerald-deep)] mb-2">
                      {isAr ? 'البريد الإلكتروني' : 'Email'} *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="example@email.com"
                      dir="auto"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--wn-emerald-deep)] mb-2">
                      {isAr ? 'رقم الهاتف (اختياري)' : 'Phone (optional)'}
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+20..."
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--wn-emerald-deep)] mb-2">
                      {isAr ? 'الموضوع' : 'Subject'} *
                    </label>
                    <input
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      placeholder={isAr ? 'موضوع الرسالة' : 'Message subject'}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--wn-emerald-deep)] mb-2">
                    {isAr ? 'الرسالة' : 'Message'} *
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    placeholder={isAr ? 'اكتب تفاصيل استفسارك...' : 'Tell us how we can help...'}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="wn-btn wn-btn--primary wn-btn--lg wn-btn--block disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <>
                      <Send size={17} /> {isAr ? 'إرسال الرسالة' : 'Send message'}
                    </>
                  )}
                </button>
              </form>
            </motion.div>

            <aside className="wn-public-track-banner !mt-0 space-y-4">
              <div>
                <span className="wn-auth-visual__eyebrow">{isAr ? 'قبل الإرسال' : 'BEFORE YOU SEND'}</span>
                <h2>{isAr ? 'معلومة تساعدنا نرد بشكل أفضل' : 'One detail helps us respond better'}</h2>
                <p>
                  {isAr
                    ? 'لو سؤالك عن طالب أو حجز أو دورة، اذكر البريد المستخدم في الحساب واسم المسار إن وجد. لا ترسل كلمات مرور أو بيانات دفع.'
                    : 'For a learner, booking, or course question, include the account email and path name if relevant. Never send passwords or payment credentials.'}
                </p>
              </div>

              <div className="grid gap-2.5 pt-3 border-t border-white/15 text-xs">
                <div className="flex items-center gap-2 text-[#efd28e]">
                  <Clock size={15} />
                  <span>{isAr ? 'متوسط وقت الرد: خلال ساعات العمل الرسمية' : 'Typical response: within working hours'}</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <ShieldCheck size={15} />
                  <span>{isAr ? 'بياناتك محمية وتُستخدم للرد على استفسارك فقط' : 'Your contact details are kept strictly private'}</span>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </>
  );
}

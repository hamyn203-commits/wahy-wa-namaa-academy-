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
import { useSEO } from '../../hooks/useSEO';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';
import '../../styles/public-experience.css';

export default function Contact() {
  const { isRTL, dir, t } = useI18n();
  const { createWebPageSchema, createBreadcrumbSchema } = useSEO();
  const toast = useToast();
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleChange = (event) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
    if (submitError) setSubmitError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError('');

    try {
      await api.post('/api/contact', formData);
      setIsSubmitted(true);
      toast.success(isRTL ? 'تم إرسال رسالتك بنجاح! سنتواصل معك قريباً.' : 'Your message has been sent!');
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
      setTimeout(() => setIsSubmitted(false), 5000);
    } catch (err) {
      const msg = err?.message || (isRTL ? 'تعذر إرسال الرسالة، حاول لاحقًا' : 'Failed to send message. Please try again later.');
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickSubjects = isRTL
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
      title: isRTL ? 'البرامج والمسارات' : 'Programs and paths',
      text: isRTL ? 'اسأل عن المسار الأنسب للمستوى والهدف.' : 'Ask which path best fits your level and goal.',
    },
    {
      icon: MessageCircle,
      title: isRTL ? 'الدعم والمساعدة' : 'Support and help',
      text: isRTL
        ? 'لو واجهتك مشكلة في الحساب أو تجربة المنصة، اشرحها لنا هنا.'
        : 'If you have an account or platform issue, describe it here.',
    },
    {
      icon: Handshake,
      title: isRTL ? 'الشراكات والتعاون' : 'Partnerships',
      text: isRTL
        ? 'للمبادرات التعليمية والمؤسسات الراغبة في التعاون.'
        : 'For educational initiatives and organizations interested in collaboration.',
    },
  ];

  const pageTitle = t.common?.contact || (isRTL ? 'تواصل معنا' : 'Contact Us');
  const pageDescription = isRTL
    ? 'تواصل مع فريق أكاديمية وحي ونماء.'
    : 'Contact the Wahy Wa Namaa Academy team.';

  return (
    <>
      <SEOHead
        page={{
          title: pageTitle,
          description: pageDescription,
          url: '/contact',
          type: 'website',
          schema: [
            createWebPageSchema({
              name: pageTitle,
              description: pageDescription,
              url: '/contact',
              type: 'ContactPage',
            }),
            createBreadcrumbSchema([
              { name: t.common?.home || (isRTL ? 'الرئيسية' : 'Home'), url: '/' },
              { name: pageTitle, url: '/contact' },
            ]),
          ],
        }}
      />
      <GlobalHeader />

      <main className="wn-public-shell" dir={dir}>
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow">
                <Sparkles size={14} aria-hidden="true" /> {isRTL ? 'تواصل مع الأكاديمية' : 'CONTACT THE ACADEMY'}
              </span>
              <h1>{isRTL ? 'كيف نقدر نساعدك؟' : 'How can we help?'}</h1>
              <p>
                {isRTL
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
                  <Icon size={21} aria-hidden="true" />
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
              <h2>{isRTL ? 'أرسل لنا رسالة' : 'Send us a message'}</h2>
              <p className="mt-1 text-sm text-[var(--wn-text-secondary)]">
                {isRTL ? 'اختر موضوع رسالتك بنقرة سريعة أو اكتب التفاصيل بوضوح.' : 'Pick a quick topic or write your inquiry in detail.'}
              </p>

              {/* Quick Subject Selector Pills */}
              <div className="mt-4">
                <span className="block text-xs font-bold text-[var(--wn-heading)] mb-2">
                  {isRTL ? 'اختيار سريع للموضوع:' : 'Quick subject selection:'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {quickSubjects.map((topic) => {
                    const selected = formData.subject === topic;
                    return (
                      <button
                        key={topic}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setFormData((prev) => ({ ...prev, subject: topic }))}
                        className={selected ? 'wn-quick-spec-pill is-active min-h-[44px]' : 'wn-quick-spec-pill min-h-[44px]'}
                      >
                        {topic}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isSubmitted ? (
                <div role="status" className="mt-5 p-4 rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] flex items-start gap-3">
                  <CheckCircle className="text-[var(--wn-link)] shrink-0" size={20} aria-hidden="true" />
                  <div>
                    <strong className="text-[var(--wn-heading)]">{isRTL ? 'تم إرسال رسالتك' : 'Message sent'}</strong>
                    <p className="text-xs text-[var(--wn-text-secondary)] mt-1">
                      {isRTL ? 'تم استلام طلبك بنجاح.' : 'Your request was received successfully.'}
                    </p>
                  </div>
                </div>
              ) : null}

              {submitError ? (
                <div id="contact-error" role="alert" className="mt-5 rounded-xl border border-[var(--wn-danger)]/40 bg-[var(--wn-danger-soft)] px-4 py-3 text-sm text-[var(--wn-danger)]">
                  {submitError}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="grid gap-4 mt-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-name" className="block text-xs font-bold text-[var(--wn-heading)] mb-2">
                      {isRTL ? 'الاسم الكامل' : 'Full name'} *
                    </label>
                    <input
                      id="contact-name"
                      name="name"
                      autoComplete="name"
                      enterKeyHint="next"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      aria-invalid={Boolean(submitError)}
                      aria-describedby={submitError ? 'contact-error' : undefined}
                      placeholder={isRTL ? 'اسمك الكامل' : 'Your full name'}
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="block text-xs font-bold text-[var(--wn-heading)] mb-2">
                      {isRTL ? 'البريد الإلكتروني' : 'Email'} *
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      inputMode="email"
                      enterKeyHint="next"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      aria-invalid={Boolean(submitError)}
                      aria-describedby={submitError ? 'contact-error' : undefined}
                      placeholder="example@email.com"
                      dir="auto"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-phone" className="block text-xs font-bold text-[var(--wn-heading)] mb-2">
                      {isRTL ? 'رقم الهاتف (اختياري)' : 'Phone (optional)'}
                    </label>
                    <input
                      id="contact-phone"
                      type="tel"
                      name="phone"
                      autoComplete="tel"
                      inputMode="tel"
                      enterKeyHint="next"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+20..."
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-subject" className="block text-xs font-bold text-[var(--wn-heading)] mb-2">
                      {isRTL ? 'الموضوع' : 'Subject'} *
                    </label>
                    <input
                      id="contact-subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      aria-invalid={Boolean(submitError)}
                      aria-describedby={submitError ? 'contact-error' : undefined}
                      placeholder={isRTL ? 'موضوع الرسالة' : 'Message subject'}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-xs font-bold text-[var(--wn-heading)] mb-2">
                    {isRTL ? 'الرسالة' : 'Message'} *
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    aria-invalid={Boolean(submitError)}
                    aria-describedby={submitError ? 'contact-error' : undefined}
                    placeholder={isRTL ? 'اكتب تفاصيل استفسارك...' : 'Tell us how we can help...'}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="wn-btn wn-btn--primary wn-btn--lg wn-btn--block min-h-[44px] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                      <span className="sr-only">{isRTL ? 'جاري إرسال الرسالة...' : 'Sending message...'}</span>
                    </>
                  ) : (
                    <>
                      <Send size={17} aria-hidden="true" /> {isRTL ? 'إرسال الرسالة' : 'Send message'}
                    </>
                  )}
                </button>
              </form>
            </motion.div>

            <aside className="wn-public-track-banner !mt-0 space-y-4">
              <div>
                <span className="wn-auth-visual__eyebrow">{isRTL ? 'قبل الإرسال' : 'BEFORE YOU SEND'}</span>
                <h2>{isRTL ? 'معلومة تساعدنا نرد بشكل أفضل' : 'One detail helps us respond better'}</h2>
                <p>
                  {isRTL
                    ? 'لو سؤالك عن طالب أو حجز أو دورة، اذكر البريد المستخدم في الحساب واسم المسار إن وجد. لا ترسل كلمات مرور أو بيانات دفع.'
                    : 'For a learner, booking, or course question, include the account email and path name if relevant. Never send passwords or payment credentials.'}
                </p>
              </div>

              <div className="grid gap-2.5 pt-3 border-t border-white/15 text-xs">
                <div className="flex items-center gap-2 text-[var(--wn-gold)]">
                  <Clock size={15} aria-hidden="true" />
                  <span>{isRTL ? 'متوسط وقت الرد: خلال ساعات العمل الرسمية' : 'Typical response: within working hours'}</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <ShieldCheck size={15} aria-hidden="true" />
                  <span>{isRTL ? 'بياناتك محمية وتُستخدم للرد على استفسارك فقط' : 'Your contact details are kept strictly private'}</span>
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

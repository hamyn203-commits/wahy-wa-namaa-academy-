import {
  X, UserRound, Users, Calendar, BookOpen, CreditCard, Bell, GraduationCap,
  PlayCircle, CheckCircle2, AlertTriangle, History, MessageSquare, TrendingUp,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { formatSessionDateTime, sessionTimeZone } from '../../lib/sessionTime';

function studentAvatarUrl(value) {
  const reference = String(value || '').trim();
  if (!reference) return '';
  try {
    const url = new URL(reference, 'https://wahy.invalid');
    if (url.protocol === 'https:' && url.hostname.endsWith('.blob.vercel-storage.com')
      && url.pathname.startsWith('/uploads/student-avatar/')) {
      return '/api/uploads/public?ref=' + encodeURIComponent(reference);
    }
    if (reference.startsWith('/') && !reference.startsWith('//')) return reference;
  } catch { return ''; }
  return '';
}

function whatsappLink(value) {
  const raw = String(value || '').replace(/[^\d+]/g, '');
  const digits = raw.startsWith('+') ? raw.slice(1) : raw;
  const normalized = digits.startsWith('0') && digits.length === 11 ? '20' + digits.slice(1) : digits;
  return /^\d{8,15}$/.test(normalized) ? 'https://wa.me/' + normalized : '';
}

function titleValue(value) {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  return value.ar || value.en || '—';
}

function Info({ label, value }) {
  return (
    <div className="wn-admin-360__info">
      <span>{label}</span>
      <strong>{value === undefined || value === null || value === '' ? '—' : String(value)}</strong>
    </div>
  );
}

export default function Student360Dossier({
  dossier,
  loading,
  onClose,
  onOpenGuardian,
  onOpenTeacher,
  onOpenHomeworkAudio,
  onMessageStudent,
  onUpdateStudent,
}) {
  const student = dossier?.student;
  const summary = dossier?.summary || {};
  const [adminLevel, setAdminLevel] = useState(student?.currentLevel || 'beginner');
  const [adminTrack, setAdminTrack] = useState(student?.preferredTrack || 'memorization');
  const [adminJuz, setAdminJuz] = useState(student?.memorizedJuz ?? 0);
  const [adminActive, setAdminActive] = useState(student?.isActive !== false);
  const [savingStudent, setSavingStudent] = useState(false);

  useEffect(() => {
    setAdminLevel(student?.currentLevel || 'beginner');
    setAdminTrack(student?.preferredTrack || 'memorization');
    setAdminJuz(student?.memorizedJuz ?? 0);
    setAdminActive(student?.isActive !== false);
  }, [student?._id, student?.currentLevel, student?.preferredTrack, student?.memorizedJuz, student?.isActive]);

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    if (!onUpdateStudent || !student?._id) return;
    setSavingStudent(true);
    try {
      await onUpdateStudent(student._id, {
        currentLevel: adminLevel,
        preferredTrack: adminTrack,
        memorizedJuz: Number(adminJuz) || 0,
        isActive: Boolean(adminActive),
      });
    } finally {
      setSavingStudent(false);
    }
  };

  return (
    <div className="wn-admin-dossier-backdrop" dir="rtl" role="dialog" aria-modal="true">
      <div className="wn-admin-dossier wn-admin-people-dossier">
        <header className="wn-admin-dossier__header">
          <div>
            <span>Student 360</span>
            <h2>{student?.name || 'ملف الطالب'}</h2>
            <p>{student?.email || '—'} · {student?.phone || '—'}</p>
            {student?._id && <button type="button" onClick={() => onMessageStudent?.(student._id)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-white"><MessageSquare size={17} /> مراسلة الطالب</button>}
            {studentAvatarUrl(student?.avatar) && <img src={studentAvatarUrl(student.avatar)} alt="الصورة الشخصية للطالب" className="mt-3 w-16 h-16 rounded-full object-cover border border-slate-200" />}
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق"><X size={20} /></button>
        </header>

        {loading ? (
          <div className="wn-admin-dossier__loading">جاري تجميع الملف الكامل للطالب...</div>
        ) : (
          <div className="wn-admin-dossier__body">
            <section className="wn-admin-360-summary">
              <div><Calendar size={18} /><span><strong>{summary.totalSessions || 0}</strong><small>إجمالي الحصص</small></span></div>
              <div><CheckCircle2 size={18} /><span><strong>{summary.completedSessions || 0}</strong><small>مكتملة</small></span></div>
              <div><BookOpen size={18} /><span><strong>{summary.pendingHomework || 0}</strong><small>واجبات معلقة</small></span></div>
              <div className={summary.absentSessions ? 'is-alert' : ''}><AlertTriangle size={18} /><span><strong>{summary.absentSessions || 0}</strong><small>غياب</small></span></div>
              <div><Users size={18} /><span><strong>{summary.guardians || 0}</strong><small>أولياء أمور</small></span></div>
              <div><GraduationCap size={18} /><span><strong>{summary.activeEnrollments || 0}</strong><small>دورات نشطة</small></span></div>
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><UserRound size={18} /><h3>الحساب والملف الشخصي</h3></div>
              <div className="wn-admin-dossier__grid">
                <Info label="الاسم" value={student?.name} />
                <Info label="البريد" value={student?.email} />
                <Info label="الهاتف" value={student?.phone} />
                <div className="wn-admin-360__info"><span>WhatsApp</span>{whatsappLink(student?.whatsappPhone || student?.phone) ? <a href={whatsappLink(student?.whatsappPhone || student?.phone)} target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-bold underline">مراسلة الطالب عبر واتساب</a> : <strong>رقم غير متاح</strong>}</div>
                <Info label="العمر" value={student?.age} />
                <Info label="النوع" value={student?.gender} />
                <Info label="المستوى" value={student?.customLevel || student?.currentLevel} />
                <Info label="عدد الأجزاء المحفوظة" value={student?.memorizedJuz} />
                <Info label="تفاصيل الحفظ" value={student?.memorizationDetails} />
                <Info label="المسار" value={student?.preferredTrack} />
                <Info label="الحلقة" value={student?.circle?.name} />
                <Info label="الحساب" value={student?.isActive === false ? 'موقوف' : 'نشط'} />
                <Info label="البريد مؤكد" value={student?.emailVerified ? 'نعم' : 'لا'} />
                <Info label="آخر دخول" value={student?.lastLogin ? new Date(student.lastLogin).toLocaleString('ar-EG') : '—'} />
              </div>
              {onUpdateStudent && student?._id ? (
                <form onSubmit={handleSaveStudent} className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                  <div className="font-bold text-xs text-emerald-900">تحديث بيانات الطالب وحالة الحساب (إدارة مباشرة)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <label className="block space-y-1">
                      <span className="font-semibold text-slate-700">المستوى</span>
                      <select value={adminLevel} onChange={(e) => setAdminLevel(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white">
                        <option value="beginner">مبتدئ (beginner)</option>
                        <option value="intermediate">متوسط (intermediate)</option>
                        <option value="advanced">متقدم (advanced)</option>
                        <option value="hafiz">خاتم / مجاز (hafiz)</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-slate-700">المسار</span>
                      <select value={adminTrack} onChange={(e) => setAdminTrack(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white">
                        <option value="memorization">الحفظ والمراجعة</option>
                        <option value="tajweed_ijazah">التجويد والإجازة</option>
                        <option value="kids_foundation">تأسيس الأطفال</option>
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-slate-700">الأجزاء المحفوظة</span>
                      <input type="number" min="0" max="30" value={adminJuz} onChange={(e) => setAdminJuz(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white" />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-slate-700">حالة الحساب</span>
                      <select value={adminActive ? 'active' : 'suspended'} onChange={(e) => setAdminActive(e.target.value === 'active')} className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white">
                        <option value="active">نشط (مفعّل)</option>
                        <option value="suspended">موقوف مؤقتاً</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" disabled={savingStudent} className="px-4 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition disabled:opacity-50">
                      {savingStudent ? 'جاري الحفظ...' : 'حفظ تعديلات الطالب'}
                    </button>
                  </div>
                </form>
              ) : null}
              <div className="hidden">
              </div>
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><Users size={18} /><h3>أولياء الأمور والربط العائلي</h3></div>
              {(dossier.guardians || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">لا يوجد ولي أمر مرتبط حاليًا.</p>
              ) : (
                <div className="wn-admin-360-list">
                  {(dossier.guardians || []).map((guardian) => (
                    <button type="button" key={guardian.guardianProfileId} onClick={() => onOpenGuardian?.(guardian.user?._id)}>
                      <span><strong>{guardian.user?.name || 'ولي أمر'}</strong><small>{guardian.relationship} · {guardian.user?.email || '—'} · {guardian.user?.phone || '—'}</small></span>
                      <span>فتح Family 360</span>
                    </button>
                  ))}
                </div>
              )}

              {(dossier.guardianInvitations || []).length > 0 && (
                <div className="wn-admin-360-subsection">
                  <strong>طلبات الربط</strong>
                  {(dossier.guardianInvitations || []).map((invitation) => (
                    <div key={invitation._id}>
                      <span>{invitation.relationship} · {invitation.phoneMasked || '—'}</span>
                      <b>{invitation.status}</b>
                      <small>{new Date(invitation.createdAt).toLocaleString('ar-EG')}</small>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><Calendar size={18} /><h3>الحصص والتقارير</h3></div>
              {(dossier.sessions || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">لا توجد حصص مسجلة.</p>
              ) : (
                <div className="wn-admin-session-timeline">
                  {(dossier.sessions || []).slice(0, 40).map((session) => (
                    <article key={session._id}>
                      <div>
                        <span>{formatSessionDateTime(session, 'ar-EG', { dateStyle: 'medium', timeStyle: 'short' })} · {sessionTimeZone(session)}</span>
                        <h4>{session.teacher?.name || 'معلم'} · {session.type}</h4>
                        <small>{session.status} · حضور: {session.attendanceStatus || '—'} · {session.duration || 0} دقيقة</small>
                      </div>
                      <div className="wn-admin-session-timeline__actions">
                        {session.teacher?.id ? (
                          <button type="button" onClick={() => onOpenTeacher?.(session.teacher.id)}>ملف المعلم</button>
                        ) : null}
                        {session.recordingAvailable ? <span>يوجد تسجيل</span> : null}
                      </div>
                      {session.report ? (
                        <div className="wn-admin-session-report">
                          <span>الحفظ <b>{session.report.memorizationScore ?? '—'}/10</b></span>
                          <span>التجويد <b>{session.report.tajweedScore ?? '—'}/10</b></span>
                          <p>{session.report.surahRecited ? 'تم التسميع: ' + session.report.surahRecited : ''}</p>
                          <p>{session.report.nextHomework ? 'التالي: ' + session.report.nextHomework : ''}</p>
                          {session.report.notes ? <p>ملاحظات: {session.report.notes}</p> : null}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><BookOpen size={18} /><h3>الواجبات والتسليمات</h3></div>
              {(dossier.homework || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">لا توجد واجبات.</p>
              ) : (
                <div className="wn-admin-homework-list">
                  {(dossier.homework || []).map((task) => (
                    <article key={task._id}>
                      <div>
                        <span>{task.status}</span>
                        <h4>{task.title}</h4>
                        <small>{task.teacher?.name || 'معلم'} · {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-EG') : 'بدون موعد'}</small>
                        {task.description ? <p>{task.description}</p> : null}
                        {task.teacherFeedback ? <p><strong>ملاحظة المعلم:</strong> {task.teacherFeedback}</p> : null}
                      </div>
                      {task.submissionAvailable ? (
                        <button type="button" onClick={() => onOpenHomeworkAudio?.(task._id)}>
                          <PlayCircle size={16} /> فتح تسليم الطالب
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><TrendingUp size={18} /><h3>التقدم والدورات</h3></div>
              <div className="wn-admin-360-columns">
                <div>
                  <strong>الدورات</strong>
                  {(dossier.enrollments || []).length === 0 ? <small>لا توجد دورات.</small> : (dossier.enrollments || []).map((entry) => (
                    <div key={entry._id}><span>{titleValue(entry.course?.title)}</span><b>{entry.status}</b><small>{entry.progress?.percentage || 0}%</small></div>
                  ))}
                </div>
                <div>
                  <strong>مؤشرات التعلم</strong>
                  {(dossier.progress || []).length === 0 ? <small>لا توجد بيانات تقدم.</small> : (dossier.progress || []).map((entry) => (
                    <div key={entry._id}><span>{titleValue(entry.course?.title)}</span><b>{Math.round(entry.overallProgress?.percentage || 0)}%</b><small>متوسط {Math.round(entry.overallProgress?.averageScore || 0)}</small></div>
                  ))}
                </div>
              </div>
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><CreditCard size={18} /><h3>اشتراكات الباقات والمدفوعات</h3></div>
              {(dossier.subscriptions || []).length > 0 ? (
                <div className="mb-4 space-y-2">
                  <strong className="block text-xs text-emerald-800">اشتراكات الحلقات والباقات ({dossier.subscriptions.length})</strong>
                  <div className="wn-admin-360-table">
                    {(dossier.subscriptions || []).map((sub) => (
                      <div key={sub._id}>
                        <span>
                          <strong>{sub.pricingSnapshot?.nameAr || sub.planKey || 'باقة اشتراك'}</strong>
                          <small>{sub.circle?.name || 'بانتظار التسكين في حلقة'} · {sub.section === 'ladies' ? 'قسم السيدات' : 'قسم الرجال والأطفال'}</small>
                        </span>
                        <span>
                          <strong>الرصيد: {sub.sessionsRemaining ?? 0}/{sub.sessionCount ?? 0} حصة</strong>
                          <small>{sub.status}</small>
                        </span>
                        <small>{sub.createdAt ? new Date(sub.createdAt).toLocaleDateString('ar-EG') : '—'}</small>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {(dossier.payments || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">لا توجد عمليات دفع.</p>
              ) : (
                <div className="wn-admin-360-table">
                  {(dossier.payments || []).map((payment) => (
                    <div key={payment._id}>
                      <span><strong>{payment.subscription?.pricingSnapshot?.nameAr || (payment.kind === 'subscription' ? 'اشتراك باقة قرآن' : titleValue(payment.course?.title))}</strong><small>{payment.provider}</small></span>
                      <span><strong>{(Number(payment.amountMinor || 0) / 100).toFixed(2)} {payment.currency}</strong><small>{payment.status}</small></span>
                      <small>{new Date(payment.createdAt).toLocaleString('ar-EG')}</small>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><MessageSquare size={18} /><h3>رسائل المعلمين للطالب</h3></div>
              {(dossier.teacherUpdates || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">لا توجد رسائل فيديو من المعلمين.</p>
              ) : (
                <div className="wn-admin-360-feed">
                  {(dossier.teacherUpdates || []).map((update) => (
                    <article key={update._id}>
                      <span>{update.teacher?.personalInfo?.fullName || 'معلم'}</span>
                      <h4>{update.title}</h4>
                      <p>{update.message}</p>
                      <small>{update.videoCount || 0} فيديو · {new Date(update.publishedAt || update.createdAt).toLocaleString('ar-EG')}</small>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><Bell size={18} /><h3>آخر التنبيهات</h3></div>
              <div className="wn-admin-360-feed">
                {(dossier.notifications || []).slice(0, 30).map((notice) => (
                  <article key={notice._id}>
                    <span>{notice.type}</span>
                    <h4>{notice.title?.ar || notice.title?.en || 'تنبيه'}</h4>
                    <p>{notice.message?.ar || notice.message?.en || ''}</p>
                    <small>{notice.isRead ? 'تمت القراءة' : 'غير مقروء'} · {new Date(notice.createdAt).toLocaleString('ar-EG')}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><History size={18} /><h3>سجل تدخلات الإدارة</h3></div>
              {(dossier.audit || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">لا توجد تدخلات إدارية مسجلة.</p>
              ) : (
                <div className="wn-admin-audit-list">
                  {(dossier.audit || []).map((entry) => (
                    <div key={entry._id}>
                      <span><strong>{entry.actor?.name || 'الإدارة'}</strong><small>{new Date(entry.createdAt).toLocaleString('ar-EG')}</small></span>
                      <span><strong>{entry.action}</strong><small>{entry.reason || '—'}</small></span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}


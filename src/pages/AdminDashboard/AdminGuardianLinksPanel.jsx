import { useCallback, useEffect, useState } from 'react';
import { Link2, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import api from '../../lib/api';

const RELATION_LABEL = {
  father: 'الأب',
  mother: 'الأم',
  guardian: 'ولي أمر',
  other: 'أخرى',
};

export default function AdminGuardianLinksPanel({ onOpenStudent }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = statusFilter === 'pending' ? '/api/admin/people/guardian-links?status=pending' : '/api/admin/people/guardian-links?status=' + encodeURIComponent(statusFilter);
      const result = await api.get(endpoint, { auth: true });
      setItems(result.invitations || []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="wn-admin-guardian-links">
      <header>
        <div>
          <span>GUARDIAN LINK REQUESTS</span>
          <h3><Link2 size={18} /> طلبات ربط أولياء الأمور</h3>
          <p>طلبات Pending النشطة فقط. رقم ولي الأمر يظهر بصورة مخفية حفاظًا على الخصوصية.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="تصفية طلبات الربط حسب الحالة"
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-slate-700 font-semibold"
          >
            <option value="pending">معلقة (Pending)</option>
            <option value="accepted">مقبولة (Accepted)</option>
            <option value="rejected">مرفوضة (Rejected)</option>
            <option value="expired">منتهية (Expired)</option>
            <option value="all">كل الحالات</option>
          </select>
          <button type="button" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> تحديث</button>
        </div>
      </header>

      {loading ? (
        <div className="wn-admin-guardian-links__empty">جاري تحميل الطلبات...</div>
      ) : items.length === 0 ? (
        <div className="wn-admin-guardian-links__empty"><ShieldCheck size={20} /> لا توجد طلبات ربط معلقة.</div>
      ) : (
        <div className="wn-admin-guardian-links__list">
          {items.map((item) => (
            <article key={item._id}>
              <span className="wn-admin-guardian-links__icon"><UserRound size={17} /></span>
              <div>
                <strong>{item.student?.name || 'طالب'}</strong>
                <small>{item.student?.email || '—'} · {RELATION_LABEL[item.relationship] || item.relationship}</small>
              </div>
              <div>
                <strong>{item.phoneMasked || '—'}</strong>
                <small>ينتهي {new Date(item.expiresAt).toLocaleDateString('ar-EG')}</small>
              </div>
              <button type="button" onClick={() => onOpenStudent?.(item.student?._id)}>فتح Student 360</button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

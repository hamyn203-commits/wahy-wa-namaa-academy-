import { useCallback, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import api from '../../lib/api';
import { localizedPath } from '../../lib/locale';
import AdminPeopleSearch from './AdminPeopleSearch';
import Family360Dossier from './Family360Dossier';
import Student360Dossier from './Student360Dossier';
import TeacherReviewDossier from './TeacherReviewDossier';
import TeacherSafeActionModal from './TeacherSafeActionModal';

const AdminQuickDossierHost = forwardRef(function AdminQuickDossierHost({
  approvedTeachers = [],
  onChanged,
}, ref) {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const tt = t.adminPortal.toasts;

  const [studentDossier, setStudentDossier] = useState(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [familyDossier, setFamilyDossier] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [teacherDossier, setTeacherDossier] = useState(null);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherSafeModal, setTeacherSafeModal] = useState(null);
  const studentReqRef = useRef(0);
  const familyReqRef = useRef(0);
  const teacherReqRef = useRef(0);

  const closeStudent = useCallback(() => {
    studentReqRef.current += 1;
    setStudentDossier(null);
    setStudentLoading(false);
  }, []);

  const closeGuardian = useCallback(() => {
    familyReqRef.current += 1;
    setFamilyDossier(null);
    setFamilyLoading(false);
  }, []);

  const closeTeacher = useCallback(() => {
    teacherReqRef.current += 1;
    setTeacherDossier(null);
    setTeacherLoading(false);
  }, []);

  const openStudent = useCallback(async (studentId) => {
    if (!studentId) return;
    closeGuardian();
    closeTeacher();
    const reqId = ++studentReqRef.current;
    setStudentLoading(true);
    setStudentDossier({ student: { _id: studentId } });
    try {
      const res = await api.get(`/api/admin/people/students/${studentId}`, { auth: true });
      if (studentReqRef.current === reqId) {
        setStudentDossier(res);
      }
    } catch (err) {
      if (studentReqRef.current === reqId) {
        setStudentDossier(null);
        toast.error(err.message || tt.dossierLoadFailed);
      }
    } finally {
      if (studentReqRef.current === reqId) {
        setStudentLoading(false);
      }
    }
  }, [closeGuardian, closeTeacher, toast, tt.dossierLoadFailed]);

  const openGuardian = useCallback(async (guardianId) => {
    if (!guardianId) return;
    closeStudent();
    closeTeacher();
    const reqId = ++familyReqRef.current;
    setFamilyLoading(true);
    setFamilyDossier({ guardian: { _id: guardianId } });
    try {
      const res = await api.get(`/api/admin/people/guardians/${guardianId}`, { auth: true });
      if (familyReqRef.current === reqId) {
        setFamilyDossier(res);
      }
    } catch (err) {
      if (familyReqRef.current === reqId) {
        setFamilyDossier(null);
        toast.error(err.message || tt.familyLoadFailed);
      }
    } finally {
      if (familyReqRef.current === reqId) {
        setFamilyLoading(false);
      }
    }
  }, [closeStudent, closeTeacher, toast, tt.familyLoadFailed]);

  const openTeacher = useCallback(async (teacherId) => {
    if (!teacherId) return;
    closeStudent();
    closeGuardian();
    const reqId = ++teacherReqRef.current;
    setTeacherLoading(true);
    setTeacherDossier({ teacher: { _id: teacherId } });
    try {
      const res = await api.get(`/api/teachers/admin/${teacherId}/review-dossier`, { auth: true });
      if (teacherReqRef.current === reqId) {
        setTeacherDossier(res);
      }
    } catch (err) {
      if (teacherReqRef.current === reqId) {
        setTeacherDossier(null);
        toast.error(err.message || tt.dossierLoadFailed);
      }
    } finally {
      if (teacherReqRef.current === reqId) {
        setTeacherLoading(false);
      }
    }
  }, [closeStudent, closeGuardian, toast, tt.dossierLoadFailed]);

  useImperativeHandle(ref, () => ({
    openStudent,
    openGuardian,
    openTeacher,
  }), [openStudent, openGuardian, openTeacher]);

  const fetchAsset = async (path) => {
    const response = await api.request(path, { auth: true, json: false, method: 'GET' });
    return response.blob();
  };

  const fetchPlayback = async (signPath, fallbackPath) => {
    try {
      const preview = await api.get(signPath, { auth: true });
      if (typeof preview?.url === 'string' && (preview.url.startsWith('/api/teachers/admin-media-range/') || preview.url.startsWith('https://'))) {
        return preview;
      }
      throw new Error(tt.playbackUrlFailed);
    } catch (err) {
      if (err?.code === 'MEDIA_PREVIEW_NOT_SUPPORTED') return fetchAsset(fallbackPath);
      throw err;
    }
  };

  const updateStudentProfile = async (studentId, settings) => {
    try {
      await api.put(`/api/admin/people/students/${studentId}`, {
        ...settings,
        adminReason: 'Admin update from quick Student 360',
      }, { auth: true });
      toast.success(tt.studentUpdated);
      await openStudent(studentId);
      await onChanged?.();
    } catch (err) {
      toast.error(err.message || tt.studentUpdateFailed);
    }
  };

  const updateTeacherSettings = async (teacherId, settings) => {
    try {
      await api.put(`/api/admin/teachers/${teacherId}`, {
        ...settings,
        adminReason: 'Admin update from quick Teacher 360',
      }, { auth: true });
      toast.success(tt.teacherSettingsUpdated);
      await openTeacher(teacherId);
      await onChanged?.();
    } catch (err) {
      toast.error(err.message || tt.teacherSettingsFailed);
    }
  };

  const updateChecklist = async (teacherId, key, status, note = '') => {
    try {
      await api.put(`/api/teachers/admin/${teacherId}/review-checklist/${key}`, { status, note }, { auth: true });
      await openTeacher(teacherId);
      return true;
    } catch (err) {
      toast.error(err.message || tt.checklistFailed);
      return false;
    }
  };

  const reviewTeacher = async (teacherId, action, note = '') => {
    try {
      await api.put(`/api/teachers/admin/${teacherId}/review`, { action, note }, { auth: true });
      closeTeacher();
      await onChanged?.();
      return true;
    } catch (err) {
      toast.error(err.message || tt.teacherCreateFailed);
      return false;
    }
  };

  const reviewProfileChange = async (teacherId, action, note = '') => {
    try {
      await api.put(`/api/teachers/admin/${teacherId}/profile-change/review`, { action, note }, { auth: true });
      await openTeacher(teacherId);
      await onChanged?.();
      return true;
    } catch (err) {
      toast.error(err.message || tt.profileChangeFailed);
      return false;
    }
  };

  return (
    <>
      <AdminPeopleSearch
        onOpenStudent={openStudent}
        onOpenGuardian={openGuardian}
        onOpenTeacher={openTeacher}
        onOpenPayments={() => navigate(localizedPath('/admin/payments', locale))}
      />

      {studentDossier && (
        <Student360Dossier
          dossier={studentDossier}
          loading={studentLoading}
          onClose={closeStudent}
          onOpenGuardian={openGuardian}
          onOpenTeacher={openTeacher}
          onMessageStudent={(sId) => {
            closeStudent();
            navigate(`${localizedPath('/admin', locale)}?tab=messages&student=${encodeURIComponent(sId)}`);
          }}
          onUpdateStudent={updateStudentProfile}
          onRefreshStudent={async (sId) => {
            await openStudent(sId);
            await onChanged?.();
          }}
          onNavigateSubscriptions={() => {
            closeStudent();
            navigate(localizedPath('/admin/subscriptions', locale));
          }}
          approvedTeachers={approvedTeachers}
        />
      )}

      {familyDossier && (
        <Family360Dossier
          dossier={familyDossier}
          loading={familyLoading}
          onClose={closeGuardian}
          onOpenStudent={openStudent}
          onRefreshFamily={openGuardian}
        />
      )}

      {teacherDossier && (
        <TeacherReviewDossier
          dossier={teacherDossier}
          loading={teacherLoading}
          onClose={closeTeacher}
          onChecklist={updateChecklist}
          onReview={reviewTeacher}
          onOpenDocument={(id, kind, idx) => fetchAsset(`/api/teachers/admin/${id}/document/${kind}${Number.isInteger(idx) ? `/${idx}` : ''}?reason=teacher-review`)}
          onOpenMedia={(id, kind, idx) => (
            kind === 'profilePhoto'
              ? fetchAsset(`/api/teachers/admin/${id}/media/${kind}${Number.isInteger(idx) ? `/${idx}` : ''}?reason=teacher-review`)
              : fetchPlayback(
                `/api/teachers/admin/${id}/media-playback/${kind}${Number.isInteger(idx) ? `/${idx}` : ''}`,
                `/api/teachers/admin/${id}/media/${kind}${Number.isInteger(idx) ? `/${idx}` : ''}?reason=teacher-review`
              )
          )}
          onOpenProfileChangeMedia={(id, kind) => (
            kind === 'profilePhoto'
              ? fetchAsset(`/api/teachers/admin/${id}/profile-change/media/${kind}?reason=profile-change-review`)
              : fetchPlayback(
                `/api/teachers/admin/${id}/profile-change/media-playback/${kind}`,
                `/api/teachers/admin/${id}/profile-change/media/${kind}?reason=profile-change-review`
              )
          )}
          onProfileChangeReview={reviewProfileChange}
          onPreviewPublic={(tId) => window.open(localizedPath(`/teachers/${encodeURIComponent(tId)}`, locale), '_blank', 'noopener,noreferrer')}
          onUpdateAdminSettings={updateTeacherSettings}
          onDeleteTeacher={(id, label) => setTeacherSafeModal({ teacherId: id, label, mode: 'delete' })}
          onSafeSuspendTeacher={(id, label) => setTeacherSafeModal({ teacherId: id, label, mode: 'suspend' })}
          onRefreshDossier={openTeacher}
          onOpenStudent={openStudent}
        />
      )}

      <TeacherSafeActionModal
        modalState={teacherSafeModal}
        onClose={() => setTeacherSafeModal(null)}
        onCompleted={async (tId) => {
          if (String(teacherDossier?.teacher?._id) === String(tId)) closeTeacher();
          await onChanged?.();
        }}
      />
    </>
  );
});

export default AdminQuickDossierHost;

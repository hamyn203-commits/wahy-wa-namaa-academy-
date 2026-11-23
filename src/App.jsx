import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx';
import { ToastProvider } from './context/ToastProvider';
import { I18nProvider, useI18n } from './i18n';
import { MarketProvider } from './context/MarketProvider';
import LocaleLayout from './components/LocaleLayout';
import { StudentLegacyRedirect, TeacherLegacyRedirect, GuardianLegacyRedirect, AdminLegacyRedirect, AuthenticatedLanding } from './components/DashboardRedirect';
import BrandLogo from './components/BrandLogo';
import { withChunkRetry } from './lib/chunkRecovery';
import ErrorBoundary from './components/shared/ErrorBoundary';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { StudentPublicRedirect, StudentShell } from './components/StudentArea';
import PageVisitTracker from './components/PageVisitTracker';

const lazyPage = (importer) => lazy(withChunkRetry(importer));

const QuranChatWidget = lazyPage(() => import('./components/QuranChatWidget'));
const PwaInstallPrompt = lazyPage(() => import('./components/PwaInstallPrompt'));

const LandingPage = lazyPage(() => import('./pages/NewLandingPage'));
const StudentJourney = lazyPage(() => import('./pages/StudentJourney'));
const StartPage = lazyPage(() => import('./pages/Start'));
const LiveSessions = lazyPage(() => import('./pages/LiveSessions/LiveSessions'));
const LiveRoom = lazyPage(() => import('./pages/LiveRoom/LiveRoom'));
const NotFoundPage = lazyPage(() => import('./pages/NotFound/NotFound'));
const TeacherRegistration = lazyPage(() => import('./pages/TeacherRegistration'));
const Teachers = lazyPage(() => import('./pages/Teachers'));
const TeacherProfile = lazyPage(() => import('./pages/TeacherProfile'));
const AdminDashboard = lazyPage(() => import('./pages/AdminDashboard'));
const TeacherDashboard = lazyPage(() => import('./pages/TeacherDashboard/TeacherDashboardGate'));
const StudentDashboard = lazyPage(() => import('./pages/StudentDashboard'));
const GuardianDashboard = lazyPage(() => import('./pages/GuardianDashboard'));
const BookSession = lazyPage(() => import('./pages/BookSession'));
const FreeTrial = lazyPage(() => import('./pages/FreeTrial/FreeTrial'));
const GlobalPlatform = lazyPage(() => import('./pages/GlobalPlatform/GlobalPlatform'));
const MarketsIndex = lazyPage(() => import('./pages/Markets'));
const MarketDetail = lazyPage(() => import('./pages/Markets/MarketDetail'));
const Courses = lazyPage(() => import('./pages/Courses'));
const CourseDetail = lazyPage(() => import('./pages/CourseDetail'));
const CourseLearn = lazyPage(() => import('./pages/CourseLearn'));
const Blog = lazyPage(() => import('./pages/Blog'));
const BlogDetail = lazyPage(() => import('./pages/BlogDetail'));
const Contact = lazyPage(() => import('./pages/Contact'));
const About = lazyPage(() => import('./pages/About'));
const FAQPage = lazyPage(() => import('./pages/FAQ'));
const Privacy = lazyPage(() => import('./pages/Privacy'));
const Terms = lazyPage(() => import('./pages/Terms'));
const CertificateView = lazyPage(() => import('./pages/Certificate'));
const Login = lazyPage(() => import('./pages/Login'));
const ProfileSetup = lazyPage(() => import('./pages/ProfileSetup'));
const Register = lazyPage(() => import('./pages/Register'));
const ForgotPassword = lazyPage(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyPage(() => import('./pages/ResetPassword'));
const AIHub = lazyPage(() => import('./pages/AIHub'));
const Donate = lazyPage(() => import('./pages/Donate'));
const PaymentReturn = lazyPage(() => import('./pages/PaymentReturn'));
const ManualPayment = lazyPage(() => import('./pages/ManualPayment'));
const AdminPayments = lazyPage(() => import('./pages/AdminPayments'));
const AdminSubscriptions = lazyPage(() => import('./pages/AdminSubscriptions'));
const AdminTrials = lazyPage(() => import('./pages/AdminTrials'));
const WomenPortal = lazyPage(() => import('./pages/Women'));
const VideoLibrary = lazyPage(() => import('./pages/Library'));
const Careers = lazyPage(() => import('./pages/Careers'));
const RevertsProgram = lazyPage(() => import('./pages/Programs/Reverts'));
const KidsProgram = lazyPage(() => import('./pages/Programs/Kids'));
const TracksPage = lazyPage(() => import('./pages/Tracks'));
const MobileAppPage = lazyPage(() => import('./pages/Mobile'));
const LeaderboardPage = lazyPage(() => import('./pages/Leaderboard'));
const NotificationsPage = lazyPage(() => import('./pages/Notifications'));
const NotificationSettings = lazyPage(() => import('./pages/Settings/Notifications'));
const MeetingRoom = lazyPage(() => import('./pages/Meeting/MeetingRoom'));
const SessionRsvp = lazyPage(() => import('./pages/SessionRsvp'));
const PlansPage = lazyPage(() => import('./pages/Plans'));

function PageLoader() {
  const { t } = useI18n();
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <BrandLogo size={58} />
      <div className="spinner spinner-lg" aria-hidden="true" />
      <span style={{ color: 'var(--wn-text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}>
        {t?.common?.loading || 'Loading…'}
      </span>
    </div>
  );
}

function pageRoutes() {
  return (
    <>
      <Route index element={<AuthenticatedLanding><LandingPage /></AuthenticatedLanding>} />
      <Route path="login" element={<AuthenticatedLanding><Login /></AuthenticatedLanding>} />
      {/* Signed-in students never see public marketing pages: they are sent to their dashboard. */}
      <Route path="start" element={<StudentPublicRedirect><StartPage /></StudentPublicRedirect>} />
      <Route path="journey" element={<StudentShell><StudentJourney /></StudentShell>} />
      <Route path="forgot-password" element={<ForgotPassword />} />
      <Route path="reset-password" element={<ResetPassword />} />
      <Route path="register" element={<StudentPublicRedirect><Register /></StudentPublicRedirect>} />
      <Route path="register/student" element={<StudentPublicRedirect><Register /></StudentPublicRedirect>} />
      <Route path="register/guardian" element={<StudentPublicRedirect><Register /></StudentPublicRedirect>} />
      <Route path="register/teacher" element={<StudentPublicRedirect><TeacherRegistration /></StudentPublicRedirect>} />
      <Route path="about" element={<StudentPublicRedirect><About /></StudentPublicRedirect>} />
      <Route path="faq" element={<StudentPublicRedirect tab="support"><FAQPage /></StudentPublicRedirect>} />
      <Route path="privacy" element={<StudentShell><Privacy /></StudentShell>} />
      <Route path="terms" element={<StudentShell><Terms /></StudentShell>} />
      <Route path="courses" element={<StudentShell><Courses /></StudentShell>} />
      <Route path="courses/:slug" element={<StudentShell><CourseDetail /></StudentShell>} />
      <Route path="courses/:slug/learn" element={<ProtectedRoute roles={['student', 'teacher', 'admin']}><CourseLearn /></ProtectedRoute>} />
      <Route path="courses/:slug/learn/:lessonId" element={<ProtectedRoute roles={['student', 'teacher', 'admin']}><CourseLearn /></ProtectedRoute>} />
      <Route path="blog" element={<StudentPublicRedirect><Blog /></StudentPublicRedirect>} />
      <Route path="blog/:slug" element={<StudentPublicRedirect><BlogDetail /></StudentPublicRedirect>} />
      <Route path="contact" element={<StudentPublicRedirect tab="support"><Contact /></StudentPublicRedirect>} />
      <Route path="verify-certificate/:certificateId" element={<StudentShell><CertificateView /></StudentShell>} />
      <Route path="profile/setup" element={<ProtectedRoute roles={['student', 'teacher', 'guardian']}><ProfileSetup /></ProtectedRoute>} />
      <Route path="student" element={<StudentLegacyRedirect />} />
      <Route path="student/dashboard" element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
      <Route path="guardian" element={<GuardianLegacyRedirect />} />
      <Route path="guardian/dashboard" element={<ProtectedRoute roles={['guardian']}><GuardianDashboard /></ProtectedRoute>} />
      <Route path="teacher" element={<TeacherLegacyRedirect />} />
      <Route path="teacher/register" element={<StudentPublicRedirect><TeacherRegistration /></StudentPublicRedirect>} />
      <Route path="teacher/dashboard" element={<ProtectedRoute roles={['teacher']}><TeacherDashboard /></ProtectedRoute>} />
      {/* Students who already chose a tutor cannot browse or book other tutors. */}
      <Route path="teachers" element={<StudentShell lockPolicy="block"><Teachers /></StudentShell>} />
      <Route path="teachers/:id" element={<StudentShell lockPolicy="own-teacher"><TeacherProfile /></StudentShell>} />
      <Route path="free-trial" element={<StudentPublicRedirect tab="discover"><FreeTrial /></StudentPublicRedirect>} />
      <Route path="plans" element={<StudentShell lockPolicy="block-unless-renewal"><PlansPage /></StudentShell>} />
      <Route path="trial" element={<StudentPublicRedirect tab="discover"><FreeTrial /></StudentPublicRedirect>} />
      <Route path="book-trial/:teacherId" element={<StudentShell lockPolicy="block"><BookSession /></StudentShell>} />
      <Route path="global-platform" element={<StudentPublicRedirect><GlobalPlatform /></StudentPublicRedirect>} />
      <Route path="markets" element={<StudentPublicRedirect><MarketsIndex /></StudentPublicRedirect>} />
      <Route path="markets/:slug" element={<StudentPublicRedirect><MarketDetail /></StudentPublicRedirect>} />
      <Route path="admin/dashboard" element={<ProtectedRoute roles={['admin']}><AdminLegacyRedirect /></ProtectedRoute>} />
      <Route path="admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="admin/payments" element={<ProtectedRoute roles={['admin']}><AdminPayments /></ProtectedRoute>} />
      <Route path="admin/subscriptions" element={<ProtectedRoute roles={['admin']}><AdminSubscriptions /></ProtectedRoute>} />
      <Route path="admin/trials" element={<ProtectedRoute roles={['admin']}><AdminTrials /></ProtectedRoute>} />
      <Route path="live" element={<ProtectedRoute><LiveSessions /></ProtectedRoute>} />
      <Route path="live/:roomId" element={<ProtectedRoute><LiveRoom /></ProtectedRoute>} />
      <Route path="meeting/:sessionId" element={<ProtectedRoute><MeetingRoom /></ProtectedRoute>} />
      <Route path="sessions/:sessionId/rsvp" element={<ProtectedRoute roles={['student', 'guardian', 'admin']}><SessionRsvp /></ProtectedRoute>} />
      <Route path="ai" element={<StudentShell><AIHub /></StudentShell>} />
      <Route path="donate" element={<StudentPublicRedirect><Donate /></StudentPublicRedirect>} />
      <Route path="payment/return" element={<ProtectedRoute roles={['student', 'admin']}><StudentShell><PaymentReturn /></StudentShell></ProtectedRoute>} />
      <Route path="payment/manual" element={<ProtectedRoute roles={['student', 'guardian']}><StudentShell><ManualPayment /></StudentShell></ProtectedRoute>} />
      <Route path="women" element={<StudentPublicRedirect><WomenPortal /></StudentPublicRedirect>} />
      <Route path="library" element={<StudentShell><VideoLibrary /></StudentShell>} />
      <Route path="careers" element={<StudentPublicRedirect><Careers /></StudentPublicRedirect>} />
      <Route path="programs/reverts" element={<StudentPublicRedirect><RevertsProgram /></StudentPublicRedirect>} />
      <Route path="programs/kids" element={<StudentPublicRedirect><KidsProgram /></StudentPublicRedirect>} />
      <Route path="kids" element={<StudentPublicRedirect><KidsProgram /></StudentPublicRedirect>} />
      <Route path="tracks" element={<StudentPublicRedirect><TracksPage /></StudentPublicRedirect>} />
      <Route path="leaderboard" element={<StudentShell><LeaderboardPage /></StudentShell>} />
      <Route path="app" element={<StudentShell><MobileAppPage /></StudentShell>} />
      <Route path="mobile" element={<StudentShell><MobileAppPage /></StudentShell>} />
      <Route path="notifications" element={<ProtectedRoute><StudentShell><NotificationsPage /></StudentShell></ProtectedRoute>} />
      <Route path="settings/notifications" element={<ProtectedRoute><StudentShell><NotificationSettings /></StudentShell></ProtectedRoute>} />
    </>
  );
}

function AppContent() {
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LocaleLayout />}>
            {pageRoutes()}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="/:locale" element={<LocaleLayout />}>
            {pageRoutes()}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <MarketProvider>
          <AuthProvider>
            <ToastProvider>
              <Router>
                <PageVisitTracker />
                <AppContent />
                <Suspense fallback={null}><QuranChatWidget /></Suspense>
                <Suspense fallback={null}><PwaInstallPrompt /></Suspense>
              </Router>
            </ToastProvider>
          </AuthProvider>
        </MarketProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
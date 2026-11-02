import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppProvider';
import { AuthProvider } from './hooks/useAuth.jsx';
import { ToastProvider } from './context/ToastProvider';
import { I18nProvider } from './i18n';
import { MarketProvider } from './context/MarketProvider';
import LocaleLayout from './components/LocaleLayout';
import { StudentLegacyRedirect, TeacherLegacyRedirect, GuardianLegacyRedirect, AdminLegacyRedirect, AuthenticatedLanding } from './components/DashboardRedirect';
import BrandLogo from './components/BrandLogo';
const QuranChatWidget = lazy(() => import('./components/QuranChatWidget'));
const PwaInstallPrompt = lazy(() => import('./components/PwaInstallPrompt'));
import ErrorBoundary from './components/shared/ErrorBoundary';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { StudentPublicRedirect, StudentShell } from './components/StudentArea';

const LandingPage = lazy(() => import('./pages/NewLandingPage'));
const StudentJourney = lazy(() => import('./pages/StudentJourney'));
const StartPage = lazy(() => import('./pages/Start'));
const LiveSessions = lazy(() => import('./pages/LiveSessions/LiveSessions'));
const LiveRoom = lazy(() => import('./pages/LiveRoom/LiveRoom'));
const NotFoundPage = lazy(() => import('./pages/NotFound/NotFound'));
const TeacherRegistration = lazy(() => import('./pages/TeacherRegistration'));
const Teachers = lazy(() => import('./pages/Teachers'));
const TeacherProfile = lazy(() => import('./pages/TeacherProfile'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard/TeacherDashboardGate'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const GuardianDashboard = lazy(() => import('./pages/GuardianDashboard'));
const BookSession = lazy(() => import('./pages/BookSession'));
const FreeTrial = lazy(() => import('./pages/FreeTrial/FreeTrial'));
const GlobalPlatform = lazy(() => import('./pages/GlobalPlatform/GlobalPlatform'));
const MarketsIndex = lazy(() => import('./pages/Markets'));
const MarketDetail = lazy(() => import('./pages/Markets/MarketDetail'));
const Courses = lazy(() => import('./pages/Courses'));
const CourseDetail = lazy(() => import('./pages/CourseDetail'));
const CourseLearn = lazy(() => import('./pages/CourseLearn'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogDetail = lazy(() => import('./pages/BlogDetail'));
const Contact = lazy(() => import('./pages/Contact'));
const About = lazy(() => import('./pages/About'));
const FAQPage = lazy(() => import('./pages/FAQ'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const CertificateView = lazy(() => import('./pages/Certificate'));
const Login = lazy(() => import('./pages/Login'));
const ProfileSetup = lazy(() => import('./pages/ProfileSetup'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AIHub = lazy(() => import('./pages/AIHub'));
const Donate = lazy(() => import('./pages/Donate'));
const PaymentReturn = lazy(() => import('./pages/PaymentReturn'));
const ManualPayment = lazy(() => import('./pages/ManualPayment'));
const AdminPayments = lazy(() => import('./pages/AdminPayments'));
const AdminSubscriptions = lazy(() => import('./pages/AdminSubscriptions'));
const AdminTrials = lazy(() => import('./pages/AdminTrials'));
const WomenPortal = lazy(() => import('./pages/Women'));
const VideoLibrary = lazy(() => import('./pages/Library'));
const Careers = lazy(() => import('./pages/Careers'));
const RevertsProgram = lazy(() => import('./pages/Programs/Reverts'));
const KidsProgram = lazy(() => import('./pages/Programs/Kids'));
const TracksPage = lazy(() => import('./pages/Tracks'));
const MobileAppPage = lazy(() => import('./pages/Mobile'));
const LeaderboardPage = lazy(() => import('./pages/Leaderboard'));
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const NotificationSettings = lazy(() => import('./pages/Settings/Notifications'));
const MeetingRoom = lazy(() => import('./pages/Meeting/MeetingRoom'));
const PlansPage = lazy(() => import('./pages/Plans'));

function PageLoader() {
  return (
    <div className="loading-overlay">
      <BrandLogo size={58} />
      <div className="spinner spinner-lg" />
      <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}>جاري التحميل...</span>
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
      <Route path="courses/:slug/learn" element={<CourseLearn />} />
      <Route path="courses/:slug/learn/:lessonId" element={<CourseLearn />} />
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
      <Route path="app" element={<StudentPublicRedirect><MobileAppPage /></StudentPublicRedirect>} />
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
          <AppProvider>
            <AuthProvider>
              <ToastProvider>
              <Router>
                <AppContent />
                <Suspense fallback={null}><QuranChatWidget /></Suspense>
                <Suspense fallback={null}><PwaInstallPrompt /></Suspense>
              </Router>
              </ToastProvider>
            </AuthProvider>
          </AppProvider>
        </MarketProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
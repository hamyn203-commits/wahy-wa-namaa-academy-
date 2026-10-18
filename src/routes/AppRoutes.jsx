import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import LocaleLayout from '../components/LocaleLayout';
import { StudentLegacyRedirect, TeacherLegacyRedirect, GuardianLegacyRedirect, AdminLegacyRedirect, AuthenticatedLanding } from '../components/DashboardRedirect';
import BrandLogo from '../components/BrandLogo';
import ProtectedRoute from '../components/auth/ProtectedRoute';

const LandingPage = lazy(() => import('../pages/NewLandingPage'));
const StudentJourney = lazy(() => import('../pages/StudentJourney'));
const StartPage = lazy(() => import('../pages/Start'));
const LiveSessions = lazy(() => import('../pages/LiveSessions/LiveSessions'));
const LiveRoom = lazy(() => import('../pages/LiveRoom/LiveRoom'));
const NotFoundPage = lazy(() => import('../pages/NotFound/NotFound'));
const TeacherRegistration = lazy(() => import('../pages/TeacherRegistration'));
const Teachers = lazy(() => import('../pages/Teachers'));
const TeacherProfile = lazy(() => import('../pages/TeacherProfile'));
const AdminDashboard = lazy(() => import('../pages/AdminDashboard'));
const TeacherDashboard = lazy(() => import('../pages/TeacherDashboard/TeacherDashboardGate'));
const StudentDashboard = lazy(() => import('../pages/StudentDashboard'));
const GuardianDashboard = lazy(() => import('../pages/GuardianDashboard'));
const BookSession = lazy(() => import('../pages/BookSession'));
const FreeTrial = lazy(() => import('../pages/FreeTrial/FreeTrial'));
const GlobalPlatform = lazy(() => import('../pages/GlobalPlatform/GlobalPlatform'));
const MarketsIndex = lazy(() => import('../pages/Markets'));
const MarketDetail = lazy(() => import('../pages/Markets/MarketDetail'));
const Courses = lazy(() => import('../pages/Courses'));
const CourseDetail = lazy(() => import('../pages/CourseDetail'));
const CourseLearn = lazy(() => import('../pages/CourseLearn'));
const Blog = lazy(() => import('../pages/Blog'));
const BlogDetail = lazy(() => import('../pages/BlogDetail'));
const Contact = lazy(() => import('../pages/Contact'));
const About = lazy(() => import('../pages/About'));
const FAQPage = lazy(() => import('../pages/FAQ'));
const Privacy = lazy(() => import('../pages/Privacy'));
const Terms = lazy(() => import('../pages/Terms'));
const CertificateView = lazy(() => import('../pages/Certificate'));
const Login = lazy(() => import('../pages/Login'));
const ProfileSetup = lazy(() => import('../pages/ProfileSetup'));
const Register = lazy(() => import('../pages/Register'));
const ForgotPassword = lazy(() => import('../pages/ForgotPassword'));
const ResetPassword = lazy(() => import('../pages/ResetPassword'));
const AIHub = lazy(() => import('../pages/AIHub'));
const Donate = lazy(() => import('../pages/Donate'));
const PaymentReturn = lazy(() => import('../pages/PaymentReturn'));
const ManualPayment = lazy(() => import('../pages/ManualPayment'));
const AdminPayments = lazy(() => import('../pages/AdminPayments'));
const AdminSubscriptions = lazy(() => import('../pages/AdminSubscriptions'));
const WomenPortal = lazy(() => import('../pages/Women'));
const VideoLibrary = lazy(() => import('../pages/Library'));
const Careers = lazy(() => import('../pages/Careers'));
const RevertsProgram = lazy(() => import('../pages/Programs/Reverts'));
const KidsProgram = lazy(() => import('../pages/Programs/Kids'));
const TracksPage = lazy(() => import('../pages/Tracks'));
const MobileAppPage = lazy(() => import('../pages/Mobile'));
const LeaderboardPage = lazy(() => import('../pages/Leaderboard'));
const NotificationsPage = lazy(() => import('../pages/Notifications'));
const NotificationSettings = lazy(() => import('../pages/Settings/Notifications'));
const MeetingRoom = lazy(() => import('../pages/Meeting/MeetingRoom'));
const PlansPage = lazy(() => import('../pages/Plans'));

function PageLoader() {
  return (
    <div className="loading-overlay">
      <BrandLogo size={58} />
      <div className="spinner spinner-lg" />
      <span className="wn-loading-label">جاري التحميل...</span>
    </div>
  );
}

function PageRoutes() {
  return (
    <>
      <Route index element={<AuthenticatedLanding><LandingPage /></AuthenticatedLanding>} />
      <Route path="login" element={<AuthenticatedLanding><Login /></AuthenticatedLanding>} />
      <Route path="start" element={<StartPage />} />
      <Route path="journey" element={<StudentJourney />} />
      <Route path="forgot-password" element={<ForgotPassword />} />
      <Route path="reset-password" element={<ResetPassword />} />
      <Route path="register" element={<Register />} />
      <Route path="register/student" element={<Register />} />
      <Route path="register/guardian" element={<Register />} />
      <Route path="register/teacher" element={<TeacherRegistration />} />
      <Route path="about" element={<About />} />
      <Route path="faq" element={<FAQPage />} />
      <Route path="privacy" element={<Privacy />} />
      <Route path="terms" element={<Terms />} />
      <Route path="courses" element={<Courses />} />
      <Route path="courses/:slug" element={<CourseDetail />} />
      <Route path="courses/:slug/learn" element={<CourseLearn />} />
      <Route path="courses/:slug/learn/:lessonId" element={<CourseLearn />} />
      <Route path="blog" element={<Blog />} />
      <Route path="blog/:slug" element={<BlogDetail />} />
      <Route path="contact" element={<Contact />} />
      <Route path="verify-certificate/:certificateId" element={<CertificateView />} />
      <Route path="profile/setup" element={<ProtectedRoute roles={['student', 'teacher', 'guardian']}><ProfileSetup /></ProtectedRoute>} />
      <Route path="student" element={<StudentLegacyRedirect />} />
      <Route path="student/dashboard" element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
      <Route path="guardian" element={<GuardianLegacyRedirect />} />
      <Route path="guardian/dashboard" element={<ProtectedRoute roles={['guardian']}><GuardianDashboard /></ProtectedRoute>} />
      <Route path="teacher" element={<TeacherLegacyRedirect />} />
      <Route path="teacher/register" element={<TeacherRegistration />} />
      <Route path="teacher/dashboard" element={<ProtectedRoute roles={['teacher']}><TeacherDashboard /></ProtectedRoute>} />
      <Route path="teachers" element={<Teachers />} />
      <Route path="teachers/:id" element={<TeacherProfile />} />
      <Route path="free-trial" element={<FreeTrial />} />
      <Route path="plans" element={<PlansPage />} />
      <Route path="trial" element={<FreeTrial />} />
      <Route path="book-trial/:teacherId" element={<BookSession />} />
      <Route path="global-platform" element={<GlobalPlatform />} />
      <Route path="markets" element={<MarketsIndex />} />
      <Route path="markets/:slug" element={<MarketDetail />} />
      <Route path="admin/dashboard" element={<ProtectedRoute roles={['admin']}><AdminLegacyRedirect /></ProtectedRoute>} />
      <Route path="admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="admin/payments" element={<ProtectedRoute roles={['admin']}><AdminPayments /></ProtectedRoute>} />
      <Route path="admin/subscriptions" element={<ProtectedRoute roles={['admin']}><AdminSubscriptions /></ProtectedRoute>} />
      <Route path="live" element={<ProtectedRoute><LiveSessions /></ProtectedRoute>} />
      <Route path="live/:roomId" element={<ProtectedRoute><LiveRoom /></ProtectedRoute>} />
      <Route path="meeting/:sessionId" element={<ProtectedRoute><MeetingRoom /></ProtectedRoute>} />
      <Route path="ai" element={<AIHub />} />
      <Route path="donate" element={<Donate />} />
      <Route path="payment/return" element={<ProtectedRoute roles={['student', 'admin']}><PaymentReturn /></ProtectedRoute>} />
      <Route path="payment/manual" element={<ProtectedRoute roles={['student']}><ManualPayment /></ProtectedRoute>} />
      <Route path="women" element={<WomenPortal />} />
      <Route path="library" element={<VideoLibrary />} />
      <Route path="careers" element={<Careers />} />
      <Route path="programs/reverts" element={<RevertsProgram />} />
      <Route path="programs/kids" element={<KidsProgram />} />
      <Route path="kids" element={<KidsProgram />} />
      <Route path="tracks" element={<TracksPage />} />
      <Route path="leaderboard" element={<LeaderboardPage />} />
      <Route path="app" element={<MobileAppPage />} />
      <Route path="notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
      <Route path="settings/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
    </>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LocaleLayout />}>
          <PageRoutes />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="/:locale" element={<LocaleLayout />}>
          <PageRoutes />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

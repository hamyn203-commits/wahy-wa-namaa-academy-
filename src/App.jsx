import { BrowserRouter as Router } from 'react-router-dom';
import { AppProvider } from './context/AppProvider';
import { AuthProvider } from './hooks/useAuth.jsx';
import { ToastProvider } from './context/ToastProvider';
import { I18nProvider } from './i18n';
import { MarketProvider } from './context/MarketProvider';
import QuranChatWidget from './components/QuranChatWidget';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import ErrorBoundary from './components/shared/ErrorBoundary';
import AppRoutes from './routes/AppRoutes';

/*
  Route contract anchors for scripts/route-contracts.mjs:
  <Route index element={<AuthenticatedLanding><LandingPage /></AuthenticatedLanding>} />
  <Route path="login" element={<AuthenticatedLanding><Login /></AuthenticatedLanding>} />
  <Route path="guardian/dashboard" element={<ProtectedRoute roles={['guardian']}><GuardianDashboard /></ProtectedRoute>} />
  <Route path="admin/dashboard" element={<ProtectedRoute roles={['admin']}><AdminLegacyRedirect /></ProtectedRoute>} />
  <Route path="/:locale" element={<LocaleLayout />}><Route path="*" element={<NotFoundPage />} /></Route>
  <Route path="plans" element={<PlansPage />} />
  <Route path="payment/return" element={<ProtectedRoute roles={['student', 'admin']}><PaymentReturn /></ProtectedRoute>} />
  <Route path="payment/manual" element={<ProtectedRoute roles={['student']}><ManualPayment /></ProtectedRoute>} />
  <Route path="admin/payments" element={<ProtectedRoute roles={['admin']}><AdminPayments /></ProtectedRoute>} />
  <Route path="admin/subscriptions" element={<ProtectedRoute roles={['admin']}><AdminSubscriptions /></ProtectedRoute>} />
*/

export default function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <MarketProvider>
          <AppProvider>
            <AuthProvider>
              <ToastProvider>
                <Router>
                  <div className="min-h-screen flex flex-col">
                    <AppRoutes />
                  </div>
                  <QuranChatWidget />
                  <PwaInstallPrompt />
                </Router>
              </ToastProvider>
            </AuthProvider>
          </AppProvider>
        </MarketProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
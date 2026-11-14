// Legacy AppProvider retired in favor of I18nProvider + AuthProvider.
// Kept as a passive pass-through wrapper to avoid breaking any external import references.
export function AppProvider({ children }) {
  return children;
}

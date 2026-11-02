import { createContext, useContext } from 'react';

// When true, public-site chrome (GlobalHeader / GlobalFooter / MobileStickyBar)
// is not rendered because the page is shown inside a dashboard shell.
export const PublicChromeContext = createContext(false);

export function usePublicChromeHidden() {
  return useContext(PublicChromeContext);
}


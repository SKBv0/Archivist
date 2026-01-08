import { useEffect, lazy, Suspense, useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider } from './context';
import { useApp } from './hooks/useApp';
import { Loader2 } from 'lucide-react';

import Navigation from './components/Navigation';
import Archive from './pages/Archive';
import GlobalEditor from './components/GlobalEditor';
import GlobalDragDrop from './components/GlobalDragDrop';
import CommandPalette from './components/CommandPalette';
import Toaster from './components/Toaster';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SyncDebugPanel } from './components/SyncDebugPanel';

const QuickSave = lazy(() => import('./pages/QuickSave'));
const Settings = lazy(() => import('./pages/Settings'));

const PageLoader = () => (
  <div className="h-screen w-full flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <Loader2 size={32} className="text-accent animate-spin" />
      <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Loading...</span>
    </div>
  </div>
);

const AppContent = () => {
  const location = useLocation();
  const { toasts, removeToast, generalSettings, selectedImage } = useApp();
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const state = location.state as { backgroundLocation?: Location };
  const isModal = !!state?.backgroundLocation && location.pathname === '/quick-save';
  const locationForRoutes = isModal ? state.backgroundLocation : location;

  useEffect(() => {
    const root = document.documentElement;
    if (generalSettings.gradientColors) {
      root.style.setProperty('--gradient-left', generalSettings.gradientColors.left);
      root.style.setProperty('--gradient-center', generalSettings.gradientColors.center);
      root.style.setProperty('--gradient-right', generalSettings.gradientColors.right);
    }
    if (generalSettings.themeAccent) {
      root.style.setProperty('--accent-hsl', generalSettings.themeAccent);
    }
  }, [generalSettings.gradientColors, generalSettings.themeAccent]);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDebugPanel(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <GlobalDragDrop>
      <div className="min-h-screen bg-background text-zinc-100 font-sans selection:bg-accent/30 selection:text-white">
        <Navigation isEditorOpen={!!selectedImage} />
        <GlobalEditor />
        <CommandPalette />
        <Toaster toasts={toasts} removeToast={removeToast} />

        <Suspense fallback={<PageLoader />}>
          <Routes location={locationForRoutes}>
            <Route path="/" element={<Archive />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/quick-save" element={<QuickSave />} />
          </Routes>

          {isModal && (
            <Routes>
              <Route path="/quick-save" element={<QuickSave />} />
            </Routes>
          )}
        </Suspense>


        <SyncDebugPanel isVisible={showDebugPanel} onClose={() => setShowDebugPanel(false)} />
      </div>
    </GlobalDragDrop>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <AppProvider>
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppContent />
        </HashRouter>
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;
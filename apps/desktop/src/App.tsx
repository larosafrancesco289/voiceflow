import { Onboarding, VoicePill, MainApp } from './components';
import { useTranscription } from './hooks/useTranscription';
import { useAppStore } from './stores/appStore';

function MainAppWindow({ initialTab }: { initialTab: 'home' | 'settings' }) {
  useTranscription({
    autoStart: true,
    listenForGlobalShortcuts: false,
  });

  return <MainApp initialTab={initialTab} />;
}

function BubbleApp() {
  const onboardingCompleted = useAppStore((state) => state.onboardingCompleted);
  const { analyser, isReady, startServer } = useTranscription({
    autoStart: onboardingCompleted,
  });
  if (!onboardingCompleted) {
    return <Onboarding isReady={isReady} onStartServer={startServer} />;
  }

  return (
    <div className="w-screen h-screen flex items-end justify-center pb-[8vh]">
      <VoicePill analyser={analyser} />
    </div>
  );
}

function App() {
  const pathname = window.location.pathname;

  if (pathname === '/main' || pathname === '/settings') {
    return <MainAppWindow initialTab={pathname === '/settings' ? 'settings' : 'home'} />;
  }

  return <BubbleApp />;
}

export default App;

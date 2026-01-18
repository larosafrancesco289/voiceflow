import { Onboarding, Settings, VoicePill, MainApp } from './components';
import { useTranscription } from './hooks/useTranscription';
import { useAppStore } from './stores/appStore';

function App() {
  const onboardingCompleted = useAppStore((state) => state.onboardingCompleted);
  const { analyser, isReady, startServer } = useTranscription({
    autoStart: onboardingCompleted,
  });
  const pathname = window.location.pathname;

  // Route: /settings
  if (pathname === '/settings') {
    return (
      <div className="settings-page min-h-screen">
        <Settings />
      </div>
    );
  }

  // Route: /main (main app window)
  if (pathname === '/main') {
    return <MainApp />;
  }

  // Default route: VoicePill (bubble window)
  if (!onboardingCompleted) {
    return <Onboarding isReady={isReady} onStartServer={startServer} />;
  }

  return (
    <div className="w-screen h-screen flex items-end justify-center pb-[8vh]">
      <VoicePill analyser={analyser} />
    </div>
  );
}

export default App;

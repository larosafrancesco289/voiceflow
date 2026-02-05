import { Onboarding, Settings, VoicePill, MainApp } from './components';
import { useTranscription } from './hooks/useTranscription';
import { useAppStore } from './stores/appStore';

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

  if (pathname === '/settings') {
    return (
      <div className="settings-page min-h-screen">
        <Settings />
      </div>
    );
  }

  if (pathname === '/main') {
    return <MainApp />;
  }

  return <BubbleApp />;
}

export default App;

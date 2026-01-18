import { Onboarding, Settings, VoicePill } from './components';
import { useTranscription } from './hooks/useTranscription';
import { useAppStore } from './stores/appStore';

function App() {
  const { analyser } = useTranscription();
  const onboardingCompleted = useAppStore((state) => state.onboardingCompleted);
  const isSettingsPage = window.location.pathname === '/settings';

  if (isSettingsPage) {
    return (
      <div className="settings-page min-h-screen">
        <Settings />
      </div>
    );
  }

  if (!onboardingCompleted) {
    return <Onboarding />;
  }

  return (
    <div className="w-screen h-screen flex items-end justify-center pb-[8vh]">
      <VoicePill analyser={analyser} />
    </div>
  );
}

export default App;

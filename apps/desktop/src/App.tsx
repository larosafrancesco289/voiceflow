import { Settings, VoicePill } from './components';
import { useTranscription } from './hooks/useTranscription';

function App() {
  const { analyser } = useTranscription();
  const isSettingsPage = window.location.pathname === '/settings';

  if (isSettingsPage) {
    return (
      <div className="settings-page min-h-screen">
        <Settings />
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: '15vh',
      }}
    >
      <VoicePill analyser={analyser} />
    </div>
  );
}

export default App;

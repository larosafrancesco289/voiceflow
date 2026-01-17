import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Note: StrictMode removed to prevent double WebSocket connections in dev
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeDevtoolDeterrent } from './security/disableDevtool';
import { AuthGate } from './security/AuthGate';

void initializeDevtoolDeterrent(typeof window !== 'undefined', import.meta.env.PROD);

createRoot(document.getElementById('root')!).render(<AuthGate>{(auth, logout) => <App authenticatedRole={auth.enabled ? auth.role : undefined} authenticatedUsername={auth.enabled ? auth.username : undefined} onLogout={auth.enabled ? logout : undefined} />}</AuthGate>);

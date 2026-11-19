import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeDevtoolDeterrent } from './security/disableDevtool';
import { AuthGate } from './security/AuthGate';

void initializeDevtoolDeterrent(typeof window !== 'undefined', import.meta.env.PROD, import.meta.env.VITE_DISABLE_DEVTOOL);

createRoot(document.getElementById('root')!).render(
  <AuthGate>
    {(auth, logout) => (
      <App
        authenticatedRole={auth.role}
        authenticatedUsername={auth.username}
        onLogout={logout}
      />
    )}
  </AuthGate>
);

import React from 'react';
import { useHashRoute, parseRoute } from './lib/router';
import { AppStateProvider } from './state/AppState';
import { AuthProvider } from './auth/AuthProvider';
import Shell from './components/Shell';
import PublicShell from './components/PublicShell';
import RequireAuth from './components/RequireAuth';
import { DashboardProvider } from './state/DashboardData';
import Home from './pages/Home';
import Blueprint from './pages/Blueprint';
import ControlPlane from './pages/ControlPlane';
import Evidence from './pages/Evidence';
import Genomes from './pages/Genomes';
import Allocation from './pages/Allocation';
import Governance from './pages/Governance';
import { Billing, BillingCancel, BillingSuccess } from './pages/billing';
import PublicHome from './pages/public/PublicHome';
import HowItWorks from './pages/public/HowItWorks';
import Proof from './pages/public/Proof';
import FoundingAccess from './pages/public/FoundingAccess';
import Trust from './pages/public/Trust';
import { Login } from './pages/Login';
import Decisions from './pages/control/Decisions';
import Escalations from './pages/control/Escalations';
import Settings from './pages/control/Settings';

function publicPage(path: string): React.ReactNode {
  switch (path) {
    case '/how-it-works':
      return <HowItWorks />;
    case '/proof':
      return <Proof />;
    case '/founding-access':
      return <FoundingAccess />;
    case '/trust':
      return <Trust />;
    case '/sign-in':
      return <Login />;
    case '/':
    default:
      return <PublicHome />;
  }
}

function privatePage(path: string): React.ReactNode {
  switch (path) {
    case '/blueprint':
      return <Blueprint />;
    case '/control-plane':
      return <ControlPlane />;
    case '/evidence':
    case '/control/evidence':
      return <Evidence />;
    case '/control/decisions':
      return <Decisions />;
    case '/control/escalations':
      return <Escalations />;
    case '/control/settings':
      return <Settings />;
    case '/genomes':
      return <Genomes />;
    case '/allocation':
      return <Allocation />;
    case '/governance':
      return <Governance />;
    case '/billing':
      return <Billing />;
    case '/billing/success':
      return <BillingSuccess />;
    case '/billing/cancel':
      return <BillingCancel />;
    case '/control':
    default:
      return <Home />;
  }
}

export default function App() {
  const raw = useHashRoute();
  const { path } = parseRoute(raw);

  const isPublic =
    path === '/' ||
    path === '/how-it-works' ||
    path === '/proof' ||
    path === '/founding-access' ||
    path === '/trust' ||
    path === '/sign-in';

  return (
    <AuthProvider>
      <AppStateProvider>
        {isPublic ? (
          <PublicShell route={path}>{publicPage(path)}</PublicShell>
        ) : (
          <RequireAuth path={path}>
            <DashboardProvider>
              <Shell route={path}>{privatePage(path)}</Shell>
            </DashboardProvider>
          </RequireAuth>
        )}
      </AppStateProvider>
    </AuthProvider>
  );
}

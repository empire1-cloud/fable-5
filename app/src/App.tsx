import React from 'react';
import { useHashRoute, parseRoute } from './lib/router';
import { AppStateProvider } from './state/AppState';
import Shell from './components/Shell';
import Home from './pages/Home';
import Blueprint from './pages/Blueprint';
import ControlPlane from './pages/ControlPlane';
import Evidence from './pages/Evidence';
import Genomes from './pages/Genomes';
import Allocation from './pages/Allocation';
import Governance from './pages/Governance';
import Memory from './pages/Memory';

function routeComponent(path: string): React.ReactNode {
  switch (path) {
    case '/':
      return <Home />;
    case '/blueprint':
      return <Blueprint />;
    case '/control-plane':
      return <ControlPlane />;
    case '/evidence':
      return <Evidence />;
    case '/genomes':
      return <Genomes />;
    case '/allocation':
      return <Allocation />;
    case '/governance':
      return <Governance />;
    case '/memory':
      return <Memory />;
    default:
      return <Home />;
  }
}

export default function App() {
  const raw = useHashRoute();
  const { path } = parseRoute(raw);

  return (
    <AppStateProvider>
      <Shell route={path}>{routeComponent(path)}</Shell>
    </AppStateProvider>
  );
}

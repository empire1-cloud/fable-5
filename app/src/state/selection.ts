import { useEffect, useState } from 'react';
import { MARKET_NODES } from '../data/genomes';

const STORAGE_KEY = 'fable5.selectedNode';

function load(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && MARKET_NODES.some((n) => n.id === raw)) return raw;
  } catch {
    /* noop */
  }
  return MARKET_NODES[0]?.id ?? '';
}

export function useSelectedNode() {
  const [nodeId, setNodeIdState] = useState<string>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, nodeId);
    } catch {
      /* noop */
    }
  }, [nodeId]);

  return { nodeId, setNodeId: setNodeIdState };
}

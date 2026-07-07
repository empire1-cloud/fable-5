import type { Allocations, ResourceDef } from '../types';

/* DEMO DATA — resource capacities and seed allocations. */

export const RESOURCES: ResourceDef[] = [
  { type: 'founder time', capacity: 40, unit: 'h/wk', step: 2, financial: false },
  { type: 'agent time', capacity: 640, unit: 'agent-h/wk', step: 20, financial: false },
  { type: 'cash', capacity: 25000, unit: '€/mo', step: 500, financial: true },
  { type: 'compute', capacity: 1200, unit: 'GPU-h/mo', step: 50, financial: false },
  { type: 'engineering capacity', capacity: 6, unit: 'build slots', step: 1, financial: false },
  { type: 'distribution capacity', capacity: 5, unit: 'channel slots', step: 1, financial: false },
  { type: 'partnership bandwidth', capacity: 4, unit: 'active tracks', step: 1, financial: false },
  { type: 'legal effort', capacity: 12, unit: 'h/mo', step: 1, financial: false },
  { type: 'operational attention', capacity: 100, unit: 'pts', step: 5, financial: false },
];

/** Targets referenced below: OPP-01..OPP-04 (opportunities), N-* (market nodes). */
export const SEED_ALLOCATIONS: Allocations = {
  'founder time': { 'N-DACH-01': 10, 'N-UK-01': 8, 'OPP-01': 8, 'OPP-02': 4 },
  'agent time': { 'N-DACH-01': 220, 'N-UK-01': 120, 'OPP-01': 120, 'OPP-02': 60, 'OPP-03': 40 },
  cash: { 'N-DACH-01': 9000, 'N-UK-01': 4500 },
  compute: { 'N-DACH-01': 500, 'N-UK-01': 250, 'OPP-02': 100 },
  'engineering capacity': { 'N-DACH-01': 2, 'N-UK-01': 1, 'OPP-01': 2 },
  'distribution capacity': { 'N-DACH-01': 2, 'N-UK-01': 1, 'OPP-01': 1 },
  'partnership bandwidth': { 'N-DACH-01': 1, 'OPP-03': 1 },
  'legal effort': { 'OPP-01': 4, 'N-UK-01': 2 },
  'operational attention': { 'N-DACH-01': 30, 'N-UK-01': 20, 'OPP-01': 20, 'OPP-02': 10 },
};

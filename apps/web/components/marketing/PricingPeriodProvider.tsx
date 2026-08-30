'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Period } from '@/content/pricing';

// The monthly/annual toggle lives in the Plans section header (Pricing.dc.html:82-85) but
// `estimate(minutes, period)` in the hero's cost estimator (Pricing.dc.html:58-75) needs that
// same period, and the two are not adjacent in the tree. This context is the shared state
// between them — see task-8-report.md for why a prop can't do this instead. Minutes stay local
// to CostEstimator; only the period is shared.
interface PricingPeriodContextValue {
  period: Period;
  setPeriod: (period: Period) => void;
}

const PricingPeriodContext = createContext<PricingPeriodContextValue | null>(null);

export function PricingPeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>('monthly');
  return (
    <PricingPeriodContext.Provider value={{ period, setPeriod }}>
      {children}
    </PricingPeriodContext.Provider>
  );
}

export function usePricingPeriod(): PricingPeriodContextValue {
  const ctx = useContext(PricingPeriodContext);
  if (!ctx) {
    throw new Error('usePricingPeriod must be used within a PricingPeriodProvider');
  }
  return ctx;
}

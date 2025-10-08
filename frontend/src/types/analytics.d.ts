declare global {
  interface Window {
    analytics?: {
      trackEvent?: (eventName: string, payload?: Record<string, unknown>) => void;
      trackProblemRT?: (payload?: Record<string, unknown>) => void;
      trackProblemExplanation?: (payload?: Record<string, unknown>) => void;
    };
  }
}

export {};

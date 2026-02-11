interface Window {
  go?: {
    main?: {
      App?: Record<string, (...args: unknown[]) => Promise<unknown>>;
    };
  };
}

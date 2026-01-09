export type Theme = 'light' | 'dark' | 'system';

/**
 * Get the current theme from localStorage or system preference
 */
export function getTheme(): Theme {
  const stored = localStorage.getItem('pc-theme') as Theme | null;
  if (stored && ['light', 'dark', 'system'].includes(stored)) {
    return stored;
  }
  return 'system';
}

/**
 * Save theme preference to localStorage
 */
export function setTheme(theme: Theme): void {
  localStorage.setItem('pc-theme', theme);
  applyTheme(theme);
}

/**
 * Apply theme to document
 */
export function applyTheme(theme: Theme): void {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const html = document.documentElement;
  if (isDark) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}

/**
 * Check if system prefers dark mode
 */
export function isSystemDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Listen for system theme changes
 */
export function watchSystemTheme(callback: (isDark: boolean) => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => callback(e.matches);

  // Use addEventListener for modern browsers
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }

  return () => {};
}

/**
 * Format Unix timestamp to readable date
 */
export function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return 'N/A';
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format Unix timestamp to readable datetime
 */
export function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) return 'N/A';
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get relative time string (e.g., "2 days ago")
 */
export function getRelativeTime(timestamp: number | null | undefined): string {
  if (!timestamp) return 'Unknown';

  const date = new Date(timestamp * 1000);
  const now = new Date();
  const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (secondsAgo < 60) return 'just now';
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
  if (secondsAgo < 604800) return `${Math.floor(secondsAgo / 86400)}d ago`;

  return formatDate(timestamp);
}

/**
 * Get status color for certificate status
 */
/**
 * Get computed RGB color from CSS variable
 * Works with OKLCH values by using browser's color computation
 */
export function getCssColorAsRgb(cssVar: string): string {
  // Create temporary element to compute color
  const temp = document.createElement('div');
  temp.style.color = `var(${cssVar})`;
  temp.style.display = 'none';
  document.body.appendChild(temp);

  const computed = getComputedStyle(temp).color;
  document.body.removeChild(temp);

  return computed; // Returns rgb(r, g, b) format
}

/**
 * Get status color for certificate status
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-success/15 text-success dark:bg-success/25';
    case 'pending':
      return 'bg-info/15 text-info dark:bg-info/25';
    case 'expiring':
      return 'bg-warning/15 text-warning dark:bg-warning/25';
    case 'expired':
      return 'bg-destructive/15 text-destructive dark:bg-destructive/25';
    default:
      return 'bg-muted text-muted-foreground';
  }
}


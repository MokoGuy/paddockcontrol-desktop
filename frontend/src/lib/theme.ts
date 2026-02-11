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
 * Format byte count to human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

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
 * Shared style constants for pending/info-themed cards
 */
export const pendingCardStyles = {
  card: "border-info/30 bg-info/10",
  title: "text-info dark:text-chart-2",
  description: "text-info/80 dark:text-chart-2/80",
  icon: "text-info dark:text-chart-2",
  iconMuted: "text-info/60 dark:text-chart-2/60",
  text: "text-info/80 dark:text-chart-2/80",
  connectorText: "text-info/70 dark:text-chart-2/70",
  connectorLine: "bg-info/20 dark:bg-chart-2/20",
} as const;

/**
 * Get status color for certificate status
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-success text-success-foreground';
    case 'pending':
      return 'bg-info text-info-foreground';
    case 'expiring':
      return 'bg-warning text-warning-foreground';
    case 'expired':
      return 'bg-destructive text-destructive-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

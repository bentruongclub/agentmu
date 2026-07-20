/**
 * Headless exit contract for `agentmu run`.
 *
 * 0 — completed successfully (tools may have run)
 * 1 — hard error (exception / fatal)
 * 2 — completed, but only permission denials on tools (no successful tool)
 */

export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_PERMISSION = 2;

export type RunStats = {
  /** At least one tool was permission-denied */
  permissionDenies: number;
  /** At least one tool ran successfully (allowed + executed) */
  toolSuccesses: number;
  /** Uncaught / fatal path */
  fatal?: boolean;
};

/**
 * Classify process exit code from run statistics.
 */
export function classifyRunExit(stats: RunStats): number {
  if (stats.fatal) return EXIT_ERROR;
  if (stats.permissionDenies > 0 && stats.toolSuccesses === 0) {
    return EXIT_PERMISSION;
  }
  return EXIT_OK;
}

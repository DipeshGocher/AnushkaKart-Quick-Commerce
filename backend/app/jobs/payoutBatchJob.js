import { bulkProcessPayouts } from "../services/finance/payoutService.js";
import logger from "../services/logger.js";

const PAYOUT_BATCH_INTERVAL_MS = () =>
  parseInt(process.env.PAYOUT_BATCH_INTERVAL_MS || "900000", 10);

/**
 * Payout batch job handler
 * Processes pending payouts in batches
 */
const payoutBatchJobHandler = async () => {
  const startTime = Date.now();
  
  try {
    const result = await bulkProcessPayouts({
      limit: parseInt(process.env.PAYOUT_BATCH_LIMIT || "100", 10),
      remarks: "Auto-batch payout job",
    });
    
    const duration = Date.now() - startTime;
    
    if (result.completed > 0 || result.failed > 0) {
      logger.info('Payout batch job completed', {
        jobName: 'payoutBatchJob',
        duration,
        completed: result.completed,
        failed: result.failed,
        total: result.total
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Payout batch job failed', {
      jobName: 'payoutBatchJob',
      duration,
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Start payout batch job using distributed scheduler
 * This function is now a no-op - the distributed scheduler handles registration
 */
export default function startPayoutBatchJob() {
  // This function is now a no-op - the distributed scheduler handles registration
  // Kept for backward compatibility
  if (!isPayoutBatchJobEnabled()) {
    return;
  }
  logger.warn('startPayoutBatchJob called directly - use distributed scheduler instead');
}

/**
 * Get the job handler function for distributed scheduler registration
 * @returns {Function}
 */
export const getPayoutBatchJobHandler = () => payoutBatchJobHandler;

/**
 * Get the job interval in milliseconds
 * @returns {number}
 */
export const getPayoutBatchJobInterval = () => PAYOUT_BATCH_INTERVAL_MS();

/**
 * Check if payout batch job is enabled
 * @returns {boolean}
 */
// ON by default: delivered orders are paid out to sellers / delivery partners automatically (a seller's money
// only after the return window); set ENABLE_PAYOUT_BATCH_JOB=false to switch it off.
export const isPayoutBatchJobEnabled = () => String(process.env.ENABLE_PAYOUT_BATCH_JOB ?? "true").toLowerCase() !== "false";

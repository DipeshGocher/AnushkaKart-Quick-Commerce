import dotenv from "dotenv";
import logger from "../services/logger.js";
import {
  sweepReturnQcDeadlines,
  releaseExpiredDisputeWindows,
  retryPendingRefunds,
} from "../services/order/returnQcService.js";

dotenv.config();

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const RETURN_QC_JOB_INTERVAL_MS = parseInt(
  process.env.RETURN_QC_JOB_INTERVAL_MS || `${DEFAULT_INTERVAL_MS}`,
  10,
);

/**
 * Return QC housekeeping (runs every few minutes):
 *   1. returned too long  -> reminders -> admin escalation -> auto QC-pass (customer refunded)
 *   2. qc_failed + dispute window closed with no dispute -> release the seller payout
 *   3. qc_passed but the refund failed earlier -> retry the refund
 * Each step is isolated so one failing never blocks the others.
 */
const runReturnQcJob = async () => {
  const started = Date.now();
  // Imported lazily: the controller owns the refund executor (transactional or legacy).
  const { completeReturnAndRefund } = await import("../controller/orderController.js");

  const steps = [
    ["deadlines", () => sweepReturnQcDeadlines({ completeRefund: completeReturnAndRefund })],
    ["dispute-window-release", () => releaseExpiredDisputeWindows()],
    ["refund-retry", () => retryPendingRefunds({ completeRefund: completeReturnAndRefund })],
  ];

  const results = {};
  for (const [name, run] of steps) {
    try {
      results[name] = await run();
    } catch (error) {
      results[name] = { error: error.message };
      logger.error("Return QC job step failed", {
        jobName: "returnQcJob",
        step: name,
        error: error.message,
      });
    }
  }

  const acted = Object.values(results).some((r) =>
    r && Object.entries(r).some(([k, v]) => k !== "checked" && k !== "error" && Number(v) > 0),
  );
  if (acted) {
    logger.info("Return QC job completed", {
      jobName: "returnQcJob",
      duration: Date.now() - started,
      results,
    });
  }
};

export const getReturnQcJobHandler = () => runReturnQcJob;
export const getReturnQcJobInterval = () => RETURN_QC_JOB_INTERVAL_MS;

export default runReturnQcJob;

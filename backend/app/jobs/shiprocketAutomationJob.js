import dotenv from "dotenv";
import logger from "../services/logger.js";
import { retryPendingShiprocketAutomation } from "../services/shipping/shiprocketAutomation.js";

dotenv.config();

const JOB_INTERVAL_MS = parseInt(process.env.SHIPROCKET_AUTOMATION_JOB_INTERVAL_MS || `${5 * 60 * 1000}`, 10);

/**
 * Every few minutes: finish courier bookings that stopped half way (AWB not assigned yet,
 * pickup or label failed) so the seller does not have to babysit them.
 */
const runShiprocketAutomationJob = async () => {
  const started = Date.now();
  try {
    const summary = await retryPendingShiprocketAutomation();
    if (summary.found) {
      logger.info("Shiprocket automation retry job completed", {
        jobName: "shiprocketAutomationJob",
        duration: Date.now() - started,
        ...summary,
      });
    }
  } catch (error) {
    logger.error("Shiprocket automation retry job failed", { jobName: "shiprocketAutomationJob", error: error.message });
  }
};

export const getShiprocketAutomationJobHandler = () => runShiprocketAutomationJob;
export const getShiprocketAutomationJobInterval = () => JOB_INTERVAL_MS;
export default runShiprocketAutomationJob;

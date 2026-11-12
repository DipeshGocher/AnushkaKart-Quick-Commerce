import dotenv from "dotenv";
import logger from "../services/logger.js";
import { expireUnverifiedUpiOrders } from "../services/order/upiApprovalExpiryService.js";

dotenv.config();

const UPI_EXPIRY_JOB_INTERVAL_MS = parseInt(process.env.UPI_EXPIRY_JOB_INTERVAL_MS || `${5 * 60 * 1000}`, 10);

/** Every few minutes: cancel UPI QR orders whose payment was not verified in time. */
const runUpiExpiryJob = async () => {
  const started = Date.now();
  try {
    const summary = await expireUnverifiedUpiOrders();
    if (summary.expired || summary.retried || summary.failed) {
      logger.info("UPI approval expiry job completed", {
        jobName: "upiApprovalExpiryJob",
        duration: Date.now() - started,
        ...summary,
      });
    }
  } catch (error) {
    logger.error("UPI approval expiry job failed", { jobName: "upiApprovalExpiryJob", error: error.message });
  }
};

export const getUpiExpiryJobHandler = () => runUpiExpiryJob;
export const getUpiExpiryJobInterval = () => UPI_EXPIRY_JOB_INTERVAL_MS;
export default runUpiExpiryJob;

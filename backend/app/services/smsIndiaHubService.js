import axios from "axios";
import { buildMessage, toIndianNumber } from "../utils/smsHelpers.js";

const SMS_INDIA_SUCCESS_CODE = "000";

function getSmsIndiaConfig() {
  return {
    apiKey: String(process.env.SMS_INDIA_HUB_API_KEY || "").trim(),
    senderId: String(process.env.SMS_INDIA_HUB_SENDER_ID || "").trim(),
    dltTemplateId: String(process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID || "").trim(),
    gatewayId: String(process.env.SMS_INDIA_HUB_GWID || "2").trim(),
    channel: String(process.env.SMS_INDIA_HUB_CHANNEL || "Trans").trim(),
    route: String(process.env.SMS_INDIA_HUB_ROUTE || "").trim(),
    peId: String(process.env.SMS_INDIA_HUB_PE_ID || "").trim(),
    url: String(
      process.env.SMS_INDIA_HUB_URL ||
        "http://cloud.smsindiahub.in/vendorsms/pushsms.aspx",
    ).trim(),
    timeoutMs: parseInt(process.env.SMS_INDIA_HUB_TIMEOUT_MS || "10000", 10),
  };
}

function normalizeProviderPayload(payload) {
  return typeof payload === "string" ? payload : JSON.stringify(payload || {});
}

function parseSmsIndiaResponse(payload) {
  const raw = normalizeProviderPayload(payload);
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  const directCode = trimmed.slice(0, 3);
  if (/^\d{3}$/.test(directCode)) {
    return { code: directCode, raw };
  }

  const xmlStatusMatch = trimmed.match(/<status>\s*([^<]+)\s*<\/status>/i);
  if (xmlStatusMatch) {
    const statusValue = String(xmlStatusMatch[1] || "").trim();
    if (/^\d{3}$/.test(statusValue)) {
      return { code: statusValue, raw };
    }
    if (["success", "ok", "done", "submitted"].includes(statusValue.toLowerCase())) {
      return { code: SMS_INDIA_SUCCESS_CODE, raw };
    }
  }

  const jsonStatusMatch = trimmed.match(
    /"status"\s*:\s*"?(success|ok|done|submitted|000)"?/i,
  );
  if (jsonStatusMatch) {
    return { code: SMS_INDIA_SUCCESS_CODE, raw };
  }

  const matched = trimmed.match(/\b(\d{3})\b/);
  if (matched) {
    return { code: matched[1], raw };
  }

  if (
    lower === "success" ||
    lower === "ok" ||
    lower === "done" ||
    lower.startsWith("success#") ||
    lower.startsWith("done#") ||
    lower.includes("message submitted")
  ) {
    return { code: SMS_INDIA_SUCCESS_CODE, raw };
  }

  return { code: null, raw };
}

function providerSnippet(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim().slice(0, 180);
}

function mapSmsIndiaError(code) {
  const messages = {
    "001": "SMS India HUB configuration issue",
    "006": "SMS India HUB DLT template mismatch",
    "007": "SMS India HUB API key is invalid",
    "021": "SMS India HUB credits exhausted",
  };
  const error = new Error(messages[code] || "SMS India HUB request failed");
  error.isKnownProviderCode = Boolean(messages[code]);
  error.statusCode = code === "001" || code === "006" || code === "007" ? 500 : 502;
  error.providerCode = code;
  return error;
}

export async function sendSmsIndiaHubOtp({ phone, otp, message }) {
  const config = getSmsIndiaConfig();
  const requiredConfig = {
    apiKey: config.apiKey,
    senderId: config.senderId,
    url: config.url,
  };
  const missing = Object.entries(requiredConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    const error = new Error(`Missing SMS India HUB config: ${missing.join(", ")}`);
    error.statusCode = 500;
    throw error;
  }

  const finalMessage = message || buildMessage(otp);
  const isMtSendSmsEndpoint = /\/api\/mt\/SendSMS/i.test(config.url);
  const params = isMtSendSmsEndpoint
    ? {
        APIKey: config.apiKey,
        senderid: config.senderId,
        channel: config.channel || "Trans",
        DCS: "0",
        flashsms: "0",
        number: toIndianNumber(phone),
        text: finalMessage,
        ...(config.dltTemplateId ? { DLTTemplateId: config.dltTemplateId } : {}),
        ...(config.route ? { route: config.route } : {}),
        ...(config.peId ? { PEId: config.peId } : {}),
      }
    : {
        APIKey: config.apiKey,
        msisdn: toIndianNumber(phone),
        sid: config.senderId,
        msg: finalMessage,
        fl: "0",
        gwid: config.gatewayId,
        ...(config.dltTemplateId
          ? {
              DLT_TE_ID: config.dltTemplateId,
              TE_ID: config.dltTemplateId,
            }
          : {}),
        ...(config.peId
          ? {
              PE_ID: config.peId,
              EntityId: config.peId,
            }
          : {}),
      };

  const response = await axios.get(config.url, {
    params,
    timeout: config.timeoutMs,
  });

  const body = response.data;
  const inlineErrorCode = body && typeof body === "object" ? body.ErrorCode : null;
  const inlineErrorMessage =
    body && typeof body === "object" ? String(body.ErrorMessage || "").trim() : "";
  const { code: providerCode, raw } = parseSmsIndiaResponse(body);
  const effectiveCode = inlineErrorCode || providerCode;

  if (effectiveCode !== SMS_INDIA_SUCCESS_CODE) {
    const error = mapSmsIndiaError(effectiveCode);
    if (inlineErrorMessage) {
      error.message = `${error.message} (${inlineErrorMessage})`;
    } else if (!error.isKnownProviderCode && raw) {
      error.message = `${error.message}: ${providerSnippet(raw)}`;
    }
    error.providerRaw = raw;
    console.error("[SMS India HUB Error]", {
      code: effectiveCode,
      url: config.url,
      raw: providerSnippet(raw),
    });
    throw error;
  }

  return {
    provider: "sms_india_hub",
    providerCode,
    rawResponse: body,
  };
}

export const __testables = {
  getSmsIndiaConfig,
  mapSmsIndiaError,
  parseSmsIndiaResponse,
};

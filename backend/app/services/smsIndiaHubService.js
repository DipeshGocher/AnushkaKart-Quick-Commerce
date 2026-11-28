import axios from "axios";
import { Resolver } from "node:dns/promises";
import https from "node:https";
import net from "node:net";
import { buildMessage, toIndianNumber } from "../utils/smsHelpers.js";

const SMS_INDIA_SUCCESS_CODE = "000";
const DNS_CACHE_TTL_MS = 10 * 60 * 1000;
const PUBLIC_DNS_SERVERS = ["8.8.8.8", "1.1.1.1", "8.8.4.4"];
const TRANSIENT_NETWORK_CODES = new Set([
  "EAI_AGAIN",
  "ENOTFOUND",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ESOCKETTIMEDOUT",
]);
const DNS_FAILURE_CODES = new Set(["EAI_AGAIN", "ENOTFOUND"]);
const resolvedIpCache = new Map(); // hostname -> { ip, expiresAt }

function isTransientNetworkError(err) {
  if (!err || err.response) return false;
  return TRANSIENT_NETWORK_CODES.has(String(err.code || "").toUpperCase());
}

function isDnsError(err) {
  if (!err || err.response) return false;
  return DNS_FAILURE_CODES.has(String(err.code || "").toUpperCase());
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function resolveIpv4ViaPublicDns(hostname) {
  if (!hostname || net.isIP(hostname)) return null;
  const now = Date.now();
  const cached = resolvedIpCache.get(hostname);
  if (cached && cached.expiresAt > now) {
    return cached.ip;
  }

  try {
    const resolver = new Resolver();
    const envServers = String(process.env.PUBLIC_DNS_SERVERS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    resolver.setServers(envServers.length > 0 ? envServers : PUBLIC_DNS_SERVERS);
    let timeoutId;
    const ips = await Promise.race([
      resolver.resolve4(hostname),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("DNS resolve timeout")), 3000);
        timeoutId.unref?.();
      }),
    ]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });
    if (Array.isArray(ips) && ips.length > 0 && net.isIPv4(ips[0])) {
      resolvedIpCache.set(hostname, { ip: ips[0], expiresAt: now + DNS_CACHE_TTL_MS });
      return ips[0];
    }
  } catch (dnsErr) {
    console.warn("[SMS India HUB DNS Fallback Failed]", dnsErr.message);
  }

  if (cached?.ip) return cached.ip;
  const envFallbackIp = String(process.env.SMS_INDIA_HUB_FALLBACK_IP || "").trim();
  return net.isIPv4(envFallbackIp) ? envFallbackIp : null;
}

function buildDirectIpRequest(url, ip, baseConfig) {
  const parsed = new URL(url);
  const direct = new URL(url);
  direct.hostname = ip;
  const nextConfig = {
    ...baseConfig,
    headers: {
      ...(baseConfig.headers || {}),
      Host: parsed.host,
    },
  };
  if (parsed.protocol === "https:") {
    nextConfig.httpsAgent = new https.Agent({ servername: parsed.hostname });
  }
  return { url: direct.toString(), config: nextConfig };
}

async function requestSmsGateway(url, { params, timeout }) {
  const baseConfig = { params, timeout, family: 4 };
  let parsedUrl = null;
  try {
    parsedUrl = new URL(url);
  } catch {
    parsedUrl = null;
  }

  let lastError;
  // Attempts 1-2 use the normal URL; if OS DNS fails with EAI_AGAIN/ENOTFOUND,
  // attempt 3+ resolves the IPv4 address via public DNS (8.8.8.8/1.1.1.1) and connects directly.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await axios.get(url, baseConfig);
    } catch (err) {
      lastError = err;
      if (!isTransientNetworkError(err)) throw err;
      if (attempt < 2) await wait(200);
    }
  }

  if (isDnsError(lastError) && parsedUrl?.hostname) {
    const fallbackIp = await resolveIpv4ViaPublicDns(parsedUrl.hostname);
    if (fallbackIp) {
      const direct = buildDirectIpRequest(url, fallbackIp, baseConfig);
      try {
        return await axios.get(direct.url, direct.config);
      } catch (err) {
        lastError = err;
        if (!isTransientNetworkError(err)) throw err;
      }
    }
  }

  if (isTransientNetworkError(lastError)) {
    console.error("[SMS India HUB Network Error]", {
      code: lastError.code,
      message: lastError.message,
      url,
    });
    const error = new Error("SMS gateway is temporarily unreachable. Please try again in a few seconds.");
    error.statusCode = 503;
    error.providerCode = lastError.code;
    throw error;
  }

  throw lastError;
}

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

  const response = await requestSmsGateway(config.url, {
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

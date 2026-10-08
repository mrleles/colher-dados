export type DeviceInfo = {
  brand: string | null;
  model: string | null;
  os: string | null;
};

type UserAgentDataLike = {
  platform?: string;
  mobile?: boolean;
  getHighEntropyValues?: (hints: string[]) => Promise<{
    model?: string;
    platform?: string;
    platformVersion?: string;
  }>;
};

type BatteryManagerLike = {
  level?: number;
};

function normalize(value: string | undefined | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function osFromUserAgent(userAgent: string) {
  if (/Android/i.test(userAgent)) return "Android";
  if (/(iPhone|iPad|iPod)/i.test(userAgent)) return "iOS";
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/(Macintosh|Mac OS X)/i.test(userAgent)) return "macOS";
  if (/CrOS/i.test(userAgent)) return "ChromeOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return null;
}

function androidModelFromUserAgent(userAgent: string) {
  const comment = userAgent.match(/\(([^)]*)\)/)?.[1];
  if (!comment) return null;

  const parts = comment.split(";").map((part) => part.trim());
  const androidIndex = parts.findIndex((part) => /^Android\b/i.test(part));
  if (androidIndex < 0) return null;

  for (const part of parts.slice(androidIndex + 1)) {
    if (!part || /^Build\//i.test(part) || /^wv$/i.test(part) || /^(Mobile|Tablet)$/i.test(part)) {
      continue;
    }

    if (/^[a-z]{2}(?:-[A-Z]{2})?$/i.test(part)) continue;
    if (part === "K") return null;

    return part.replace(/\s+Build\/.*/i, "").trim() || null;
  }

  return null;
}

export async function collectDeviceInfo(userAgent: string): Promise<DeviceInfo> {
  const uaData = (navigator as Navigator & { userAgentData?: UserAgentDataLike }).userAgentData;

  let platform = normalize(uaData?.platform) ?? osFromUserAgent(userAgent);
  let model: string | null = null;

  if (uaData?.getHighEntropyValues) {
    try {
      const values = await uaData.getHighEntropyValues(["model", "platformVersion"]);
      platform = normalize(values.platform) ?? platform;
      model = normalize(values.model);
    } catch {
      // The browser can deny or omit high-entropy UA data. Keep the fallback.
    }
  }

  const os = platform ?? osFromUserAgent(userAgent);
  const normalizedOs = os?.toLowerCase();

  if (!model && normalizedOs === "android") {
    model = androidModelFromUserAgent(userAgent);
  }

  let brand: string | null = null;
  if (normalizedOs === "ios" || normalizedOs === "macos") {
    brand = "Apple";
  }

  return { brand, model, os };
}

export async function collectBatteryLevel(): Promise<number | null> {
  const batteryNavigator = navigator as Navigator & {
    getBattery?: () => Promise<BatteryManagerLike>;
  };

  if (!batteryNavigator.getBattery) return null;

  try {
    const battery = await batteryNavigator.getBattery();
    if (typeof battery.level !== "number" || !Number.isFinite(battery.level)) return null;

    const percentage = Math.round(battery.level * 100);
    return Math.min(100, Math.max(0, percentage));
  } catch {
    // Battery information is optional and may be unavailable in the browser.
    return null;
  }
}

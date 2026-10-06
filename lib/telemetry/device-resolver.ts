import { aos, ios } from "@naverpay/device-info";

export type DeviceModelResolution = {
  brand: string | null;
  modelName: string | null;
  confidence: "exact" | "unknown" | "unavailable";
};

function normalize(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function inferAndroidBrand(model: string, modelName: string) {
  const name = modelName.toLowerCase();
  const code = model.toUpperCase();

  if (name.startsWith("galaxy ") || name.includes("samsung")) return "Samsung";
  if (name.startsWith("pixel")) return "Google";
  if (name.startsWith("moto ") || name.startsWith("motorola ")) return "Motorola";
  if (name.startsWith("redmi ") || name.startsWith("poco ") || name.startsWith("xiaomi ")) return "Xiaomi";
  if (name.startsWith("oneplus ")) return "OnePlus";
  if (name.startsWith("oppo ")) return "OPPO";
  if (name.startsWith("vivo ")) return "vivo";
  if (name.startsWith("realme ")) return "realme";
  if (name.startsWith("honor ")) return "HONOR";
  if (name.startsWith("huawei ")) return "Huawei";
  if (name.startsWith("xperia ")) return "Sony";
  if (name.startsWith("asus ") || name.startsWith("rog phone") || name.startsWith("zenfone")) return "ASUS";
  if (name.startsWith("nokia ")) return "Nokia";
  if (name.startsWith("nothing ")) return "Nothing";
  if (name.startsWith("nubia ")) return "nubia";
  if (name.startsWith("zte ")) return "ZTE";
  if (name.startsWith("tecno ")) return "TECNO";
  if (name.startsWith("infinix ")) return "Infinix";
  if (name.startsWith("tcl ")) return "TCL";
  if (name.startsWith("lenovo ")) return "Lenovo";
  if (name.startsWith("lg ")) return "LG";
  if (name.startsWith("htc ")) return "HTC";

  if (/^SM-/i.test(code)) return "Samsung";
  if (/^RMX/i.test(code)) return "realme";
  if (/^CPH/i.test(code) && /oppo/i.test(name)) return "OPPO";

  return null;
}

export function resolveDeviceModel(
  model: string | null,
  os: string | null,
  currentBrand: string | null = null,
): DeviceModelResolution {
  const normalizedModel = normalize(model);
  const normalizedOs = normalize(os)?.toLowerCase();

  if (!normalizedModel) {
    return { brand: currentBrand, modelName: null, confidence: "unavailable" };
  }

  if (normalizedOs === "ios") {
    const modelName = normalize((ios as Record<string, string>)[normalizedModel]);
    return {
      brand: modelName ? "Apple" : currentBrand ?? "Apple",
      modelName,
      confidence: modelName ? "exact" : "unknown",
    };
  }

  if (normalizedOs === "android") {
    const modelName = normalize((aos as Record<string, string>)[normalizedModel]);
    if (!modelName) {
      return { brand: currentBrand, modelName: null, confidence: "unknown" };
    }

    return {
      brand: currentBrand ?? inferAndroidBrand(normalizedModel, modelName),
      modelName,
      confidence: "exact",
    };
  }

  return { brand: currentBrand, modelName: null, confidence: "unknown" };
}

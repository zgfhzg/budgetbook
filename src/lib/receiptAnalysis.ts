export type ReceiptItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type ReceiptAnalysis = {
  sourceName: string;
  country: string;
  language: string;
  currency: string;
  store: {
    name: string;
    address: string;
    phone: string;
  };
  purchasedAt: string;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  confidence: number;
  items: ReceiptItem[];
};

export const receiptSamples: Record<string, ReceiptAnalysis> = {
  korea: {
    sourceName: "emart24-seoul.jpg",
    country: "대한민국",
    language: "한국어",
    currency: "KRW",
    store: {
      name: "이마트24 성수포레점",
      address: "서울 성동구 왕십리로 96",
      phone: "02-1234-5678",
    },
    purchasedAt: "2026-07-20T18:42:00+09:00",
    subtotal: 13210,
    tax: 1201,
    tip: 0,
    total: 13210,
    confidence: 0.94,
    items: [
      { name: "우유 900ml", quantity: 1, unitPrice: 2980, totalPrice: 2980 },
      { name: "계란 10구", quantity: 1, unitPrice: 5490, totalPrice: 5490 },
      { name: "바나나", quantity: 1, unitPrice: 3980, totalPrice: 3980 },
      { name: "종량제 봉투", quantity: 1, unitPrice: 760, totalPrice: 760 },
    ],
  },
  hongkong: {
    sourceName: "wellcome-central-hk.jpg",
    country: "홍콩",
    language: "English",
    currency: "HKD",
    store: {
      name: "Wellcome",
      address: "Shop B, G/F, 9 Queen's Road Central, Hong Kong",
      phone: "+852 2857 8600",
    },
    purchasedAt: "2026-07-18T20:14:00+08:00",
    subtotal: 186.4,
    tax: 0,
    tip: 0,
    total: 186.4,
    confidence: 0.91,
    items: [
      { name: "Egg Tart 2pcs", quantity: 1, unitPrice: 28.0, totalPrice: 28.0 },
      { name: "Milk Tea", quantity: 2, unitPrice: 18.5, totalPrice: 37.0 },
      { name: "Pineapple Bun", quantity: 3, unitPrice: 9.8, totalPrice: 29.4 },
      { name: "Roast Pork Rice", quantity: 1, unitPrice: 92.0, totalPrice: 92.0 },
    ],
  },
  japan: {
    sourceName: "lawson-tokyo.jpg",
    country: "일본",
    language: "日本語",
    currency: "JPY",
    store: {
      name: "ローソン 渋谷三丁目店",
      address: "東京都渋谷区渋谷3-8-12",
      phone: "+81 3-3498-1234",
    },
    purchasedAt: "2026-07-19T09:27:00+09:00",
    subtotal: 1452,
    tax: 116,
    tip: 0,
    total: 1568,
    confidence: 0.89,
    items: [
      { name: "おにぎり 鮭", quantity: 2, unitPrice: 168, totalPrice: 336 },
      { name: "アイスコーヒー", quantity: 1, unitPrice: 214, totalPrice: 214 },
      { name: "サンドイッチ", quantity: 1, unitPrice: 398, totalPrice: 398 },
      { name: "からあげクン", quantity: 1, unitPrice: 504, totalPrice: 504 },
    ],
  },
};

const currencySymbols: Record<string, string> = {
  KRW: "₩",
  USD: "$",
  JPY: "¥",
  HKD: "HK$",
  EUR: "€",
  GBP: "£",
};

export function formatReceiptMoney(value: number, currency: string) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" || currency === "JPY" ? 0 : 2,
  }).format(value);
}

export function detectReceiptLocale(text: string) {
  if (/[ぁ-んァ-ン一-龯]/.test(text)) {
    return { country: "일본", language: "日本語", currency: "JPY" };
  }

  if (/[가-힣]/.test(text)) {
    return { country: "대한민국", language: "한국어", currency: "KRW" };
  }

  if (/HK\$|hong kong|hkd|octopus|queen's road|kowloon|central/i.test(text)) {
    return { country: "홍콩", language: "English", currency: "HKD" };
  }

  if (/\$|sales tax|tip|subtotal/i.test(text)) {
    return { country: "미국", language: "English", currency: "USD" };
  }

  if (/€|vat|tva|iva/i.test(text)) {
    return { country: "유럽", language: "Multiple", currency: "EUR" };
  }

  return { country: "미확인", language: "Unknown", currency: "USD" };
}

export function createReceiptAnalysisFromText(
  receiptText: string,
  sourceName = "uploaded-receipt.jpg",
): ReceiptAnalysis {
  const locale = detectReceiptLocale(receiptText);
  const lines = receiptText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const amountPattern = /([₩$¥€£]?\s?\d+(?:[,.]\d{2})?)/;
  const readAmount = (value = "") =>
    Number(value.replace(/[^\d.]/g, "").replace(/,/g, "")) || 0;
  const findLabeledAmount = (labels: string[]) => {
    const escapedLabels = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp(
      `(?:^|[^a-zA-Z가-힣])(?:${escapedLabels.join("|")})\\s*[:\\-]?\\s*([₩$¥€£]?\\s?\\d+(?:[,.]\\d{2})?)`,
      "i",
    );
    const match = receiptText.match(pattern);
    return readAmount(match?.[1]);
  };
  const items = lines
    .filter((line) => amountPattern.test(line) && !/total|subtotal|tax|vat|tip|합계|세금/i.test(line))
    .slice(0, 6)
    .map((line) => {
      const amount = readAmount(line.match(amountPattern)?.[1]);
      return {
        name: line.replace(amountPattern, "").trim() || "인식 품목",
        quantity: 1,
        unitPrice: amount,
        totalPrice: amount,
      };
    });
  const sampleKey =
    locale.currency === "JPY"
      ? "japan"
      : locale.currency === "KRW"
        ? "korea"
        : "hongkong";
  const fallback = receiptSamples[sampleKey];
  const parsedSubtotal = findLabeledAmount(["subtotal", "sub total", "소계"]);
  const parsedTax = findLabeledAmount(["sales tax", "tax", "vat", "gst", "세금"]);
  const parsedTip = findLabeledAmount(["tip", "gratuity", "service charge", "서비스차지"]);
  const parsedTotal = findLabeledAmount(["grand total", "total", "amount paid", "합계"]);
  const itemSubtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const subtotal = parsedSubtotal || itemSubtotal || fallback.subtotal;
  const tax =
    parsedTax || (locale.currency === "USD" && itemSubtotal > 0 ? Number((itemSubtotal * 0.089).toFixed(2)) : fallback.tax);
  const tip = parsedTip || fallback.tip;
  const total = parsedTotal || Number((subtotal + tax + tip).toFixed(2));

  return {
    sourceName,
    ...locale,
    store: {
      name: lines[0] ?? "상호명 확인 필요",
      address: lines.find((line) => /\d/.test(line) && /st|ave|road|서울|東京都/i.test(line)) ?? "주소 확인 필요",
      phone: lines.find((line) => /\+?\d[\d\s().-]{7,}/.test(line)) ?? "전화번호 확인 필요",
    },
    purchasedAt: new Date().toISOString(),
    subtotal,
    tax,
    tip,
    total,
    confidence: items.length > 0 ? 0.72 : 0.42,
    items: items.length > 0 ? items : fallback.items,
  };
}

export function getCurrencySymbol(currency: string) {
  return currencySymbols[currency] ?? currency;
}

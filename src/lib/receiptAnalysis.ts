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
  const parsedSubtotal = findLabeledAmount(["subtotal", "sub total", "소계"]);
  const parsedTax = findLabeledAmount(["sales tax", "tax", "vat", "gst", "세금"]);
  const parsedTip = findLabeledAmount(["tip", "gratuity", "service charge", "서비스차지"]);
  const parsedTotal = findLabeledAmount(["grand total", "total", "amount paid", "합계"]);
  const itemSubtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const subtotal = parsedSubtotal || itemSubtotal;
  const tax =
    parsedTax || (locale.currency === "USD" && itemSubtotal > 0 ? Number((itemSubtotal * 0.089).toFixed(2)) : 0);
  const tip = parsedTip;
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
    items,
  };
}

export function getCurrencySymbol(currency: string) {
  return currencySymbols[currency] ?? currency;
}

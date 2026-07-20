import { NextRequest, NextResponse } from "next/server";
import { createReceiptAnalysisFromText } from "@/lib/receiptAnalysis";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const receiptText = String(formData.get("receiptText") ?? "");
  const sourceName = file instanceof File ? file.name : "manual-receipt.txt";

  if (!receiptText.trim() && !(file instanceof File)) {
    return NextResponse.json(
      { error: "receiptText 또는 file이 필요합니다." },
      { status: 400 },
    );
  }

  const analysis = createReceiptAnalysisFromText(receiptText, sourceName);

  return NextResponse.json({
    analysis,
    pipeline: {
      ocr: file instanceof File ? "pending-provider" : "manual-text",
      localeDetection: "enabled",
      globalCurrencies: ["KRW", "USD", "JPY", "EUR", "GBP"],
      placeEnrichment: "ready-for-google-places-or-maps-provider",
    },
  });
}

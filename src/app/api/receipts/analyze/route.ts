import { NextRequest, NextResponse } from "next/server";
import { createReceiptAnalysisFromText } from "@/lib/receiptAnalysis";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  let file: File | null = null;
  let receiptText = "";
  let sourceName = "manual-receipt.txt";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as {
      receiptText?: string;
      sourceName?: string;
      storagePath?: string;
    };

    receiptText = body.receiptText ?? "";
    sourceName =
      body.sourceName ?? body.storagePath?.split("/").pop() ?? sourceName;
  } else {
    const formData = await request.formData();
    const formFile = formData.get("file");
    file = formFile instanceof File ? formFile : null;
    receiptText = String(formData.get("receiptText") ?? "");
    sourceName = file ? file.name : sourceName;
  }

  if (!receiptText.trim() && !file && !contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "receiptText 또는 file이 필요합니다." },
      { status: 400 },
    );
  }

  if (!receiptText.trim()) {
    return NextResponse.json(
      { error: "실제 OCR/AI 분석 제공자가 아직 연결되지 않았습니다." },
      { status: 501 },
    );
  }

  const analysis = createReceiptAnalysisFromText(receiptText, sourceName);

  return NextResponse.json({
    analysis,
    pipeline: {
      billingMode: "manual-trigger-only",
      provider: "text-parser",
      ocr: file || contentType.includes("application/json") ? "pending-provider" : "manual-text",
      localeDetection: "enabled",
      globalCurrencies: ["KRW", "HKD", "USD", "JPY", "EUR", "GBP"],
      placeEnrichment: "ready-for-google-places-or-maps-provider",
    },
  });
}

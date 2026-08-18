import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createReceiptAnalysisFromText } from "@/lib/receiptAnalysis";
import type { ReceiptAnalysis, ReceiptItem } from "@/lib/receiptAnalysis";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

const openAiApiUrl = "https://api.openai.com/v1/responses";
const receiptModel = process.env.OPENAI_RECEIPT_MODEL ?? "gpt-5-mini";

type AnalyzeReceiptBody = {
  receiptId?: string;
  receiptText?: string;
  sourceName?: string;
  storagePath?: string;
};

type OpenAiReceiptPayload = {
  country?: string;
  language?: string;
  currency?: string;
  store?: {
    name?: string;
    address?: string;
    phone?: string;
  };
  purchasedAt?: string;
  subtotal?: number;
  tax?: number;
  tip?: number;
  total?: number;
  confidence?: number;
  items?: ReceiptItem[];
  ocrText?: string;
};

function getEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

async function blobToDataUrl(blob: Blob) {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const mimeType = blob.type || "image/jpeg";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeReceiptAnalysis(
  payload: OpenAiReceiptPayload,
  sourceName: string,
): ReceiptAnalysis {
  const currency = payload.currency?.trim() || "HKD";
  const items =
    payload.items
      ?.filter((item) => item.name?.trim())
      .map((item) => ({
        name: item.name.trim(),
        quantity: normalizeNumber(item.quantity) || 1,
        unitPrice: normalizeNumber(item.unitPrice),
        totalPrice: normalizeNumber(item.totalPrice),
      })) ?? [];
  const itemSubtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const subtotal = normalizeNumber(payload.subtotal) || itemSubtotal;
  const tax = normalizeNumber(payload.tax);
  const tip = normalizeNumber(payload.tip);
  const total = normalizeNumber(payload.total) || subtotal + tax + tip;

  return {
    sourceName,
    country: payload.country?.trim() || "미확인",
    language: payload.language?.trim() || "Unknown",
    currency,
    store: {
      name: payload.store?.name?.trim() || "상호명 확인 필요",
      address: payload.store?.address?.trim() || "주소 확인 필요",
      phone: payload.store?.phone?.trim() || "전화번호 확인 필요",
    },
    purchasedAt: payload.purchasedAt?.trim() || new Date().toISOString(),
    subtotal,
    tax,
    tip,
    total,
    confidence: normalizeNumber(payload.confidence) || 0.65,
    items,
  };
}

async function analyzeReceiptImageWithOpenAi(imageDataUrl: string, sourceName: string) {
  const apiKey = getEnv("OPENAI_API_KEY");

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  const response = await fetch(openAiApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: receiptModel,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Extract structured expense data from this receipt image.",
                "Return only JSON that matches the schema.",
                "Focus on merchant name, address, phone, purchase datetime, currency, subtotal, tax, tip/service charge, total, line items, country, and language.",
                "Use ISO 8601 for purchasedAt when possible. If a field is unreadable, use an empty string or 0.",
              ].join(" "),
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "low",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "receipt_analysis",
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "country",
              "language",
              "currency",
              "store",
              "purchasedAt",
              "subtotal",
              "tax",
              "tip",
              "total",
              "confidence",
              "items",
              "ocrText",
            ],
            properties: {
              country: { type: "string" },
              language: { type: "string" },
              currency: { type: "string" },
              store: {
                type: "object",
                additionalProperties: false,
                required: ["name", "address", "phone"],
                properties: {
                  name: { type: "string" },
                  address: { type: "string" },
                  phone: { type: "string" },
                },
              },
              purchasedAt: { type: "string" },
              subtotal: { type: "number" },
              tax: { type: "number" },
              tip: { type: "number" },
              total: { type: "number" },
              confidence: { type: "number" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["name", "quantity", "unitPrice", "totalPrice"],
                  properties: {
                    name: { type: "string" },
                    quantity: { type: "number" },
                    unitPrice: { type: "number" },
                    totalPrice: { type: "number" },
                  },
                },
              },
              ocrText: { type: "string" },
            },
          },
          strict: true,
        },
      },
      max_output_tokens: 1400,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    const message =
      result?.error?.message ?? "OpenAI 영수증 분석 요청에 실패했습니다.";
    throw new Error(message);
  }

  const outputText =
    typeof result.output_text === "string"
      ? result.output_text
      : result.output
          ?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? [])
          .find((content: { text?: string }) => content.text)?.text;

  if (!outputText) {
    throw new Error("OpenAI 분석 결과가 비어 있습니다.");
  }

  const parsedPayload = JSON.parse(outputText) as OpenAiReceiptPayload;

  return {
    analysis: normalizeReceiptAnalysis(parsedPayload, sourceName),
    ocrText: parsedPayload.ocrText,
  };
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  let file: File | null = null;
  let receiptText = "";
  let sourceName = "manual-receipt.txt";
  let storagePath = "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as AnalyzeReceiptBody;

    receiptText = body.receiptText ?? "";
    storagePath = body.storagePath ?? "";
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

  if (file) {
    try {
    const { analysis, ocrText } = await analyzeReceiptImageWithOpenAi(
      await blobToDataUrl(file),
      sourceName,
    );

    return NextResponse.json({
      analysis,
      ocrText,
      pipeline: {
        billingMode: "manual-trigger-only",
        provider: "openai-vision",
        model: receiptModel,
        imageDetail: "low",
        localeDetection: "openai",
        globalCurrencies: ["KRW", "HKD", "USD", "JPY", "EUR", "GBP"],
        placeEnrichment: "receipt-only",
      },
    });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "OpenAI 영수증 분석에 실패했습니다.",
        },
        { status: 502 },
      );
    }
  }

  if (!receiptText.trim() && storagePath) {
    const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const authorization = request.headers.get("authorization") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !authorization) {
      return NextResponse.json(
        { error: "영수증 이미지를 불러올 인증 정보가 없습니다." },
        { status: 401 },
      );
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data, error } = await supabase.storage
      .from("receipts")
      .download(storagePath);

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "영수증 이미지를 불러오지 못했습니다." },
        { status: 404 },
      );
    }

    try {
      const { analysis, ocrText } = await analyzeReceiptImageWithOpenAi(
        await blobToDataUrl(data),
        sourceName,
      );

      return NextResponse.json({
        analysis,
        ocrText,
        pipeline: {
          billingMode: "manual-trigger-only",
          provider: "openai-vision",
          model: receiptModel,
          imageDetail: "low",
          localeDetection: "openai",
          globalCurrencies: ["KRW", "HKD", "USD", "JPY", "EUR", "GBP"],
          placeEnrichment: "receipt-only",
        },
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "OpenAI 영수증 분석에 실패했습니다.",
        },
        { status: 502 },
      );
    }
  }

  if (!receiptText.trim()) {
    return NextResponse.json(
      { error: "분석할 영수증 텍스트 또는 이미지가 필요합니다." },
      { status: 400 },
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

"use client";

import {
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Home,
  Languages,
  MapPin,
  NotebookPen,
  Plus,
  ReceiptText,
  Search,
  Sparkles,
  Settings,
  Store,
  LogOut,
  WalletCards,
} from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  formatReceiptMoney,
  receiptSamples,
  type ReceiptAnalysis,
} from "@/lib/receiptAnalysis";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type CategoryRow = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "name"
>;
type StoreRow = Pick<Database["public"]["Tables"]["stores"]["Row"], "name">;
type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"] & {
  categories: CategoryRow | null;
  stores: StoreRow | null;
};

type TransactionItem = {
  id: string;
  title: string;
  place: string;
  amount: number;
  category: string;
  time: string;
};

type UploadedReceipt = {
  id: string;
  storagePath: string;
  fileName: string;
};

type AnalyzeReceiptResponse = {
  analysis?: ReceiptAnalysis;
  pipeline?: {
    provider?: string;
  };
  error?: string;
};

const sampleTabs = [
  { key: "korea", label: "한국" },
  { key: "hongkong", label: "홍콩" },
] as const;

const money = new Intl.NumberFormat("ko-KR");
const selectedMonth = "2026-07";
const calendarDays = ["16", "17", "18", "19", "20", "21", "22"];

type BudgetAppProps = {
  userId: string;
  userEmail: string;
  onSignOut: () => Promise<void>;
};

function getLocalDate(day: string) {
  return `${selectedMonth}-${day}`;
}

function formatTransactionTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function toTransactionItem(row: TransactionRow): TransactionItem {
  return {
    id: row.id,
    title: row.title,
    place: row.stores?.name ?? "직접 입력",
    amount: Number(row.amount),
    category: row.categories?.name ?? "미분류",
    time: formatTransactionTime(row.occurred_at),
  };
}

function sanitizeStorageFileName(fileName: string) {
  const [name = "receipt", ...extensionParts] = fileName.split(".");
  const extension = extensionParts.pop();
  const safeName =
    name
      .normalize("NFKD")
      .replace(/[^\w-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "receipt";

  return extension
    ? `${safeName}.${extension.toLowerCase().replace(/[^\w]+/g, "")}`
    : safeName;
}

export function BudgetApp({ userId, userEmail, onSignOut }: BudgetAppProps) {
  const [selectedDate, setSelectedDate] = useState("20");
  const [receiptName, setReceiptName] = useState("");
  const [uploadedReceipt, setUploadedReceipt] = useState<UploadedReceipt | null>(
    null,
  );
  const [analyzedReceipt, setAnalyzedReceipt] = useState<ReceiptAnalysis | null>(
    null,
  );
  const [sampleKey, setSampleKey] =
    useState<keyof typeof receiptSamples>("hongkong");
  const [isReviewed, setIsReviewed] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isAnalyzingReceipt, setIsAnalyzingReceipt] = useState(false);
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);
  const [databaseMessage, setDatabaseMessage] = useState("");
  const [databaseError, setDatabaseError] = useState("");

  const analysis: ReceiptAnalysis =
    analyzedReceipt ?? receiptSamples[sampleKey] ?? receiptSamples.hongkong;
  const requiresAnalysisBeforeSave = Boolean(uploadedReceipt && !analyzedReceipt);
  const receiptStatusLabel = isUploadingReceipt
    ? "Supabase Storage 업로드 중"
    : isAnalyzingReceipt
      ? "사용자 요청으로 분석 중"
      : analyzedReceipt
        ? "분석 완료 - 확정 대기"
        : uploadedReceipt
          ? "원본 업로드 완료 - AI 분석 대기"
          : receiptName
            ? "업로드 준비 중"
            : "샘플 분석 결과";
  const receiptBadgeLabel = analyzedReceipt
    ? `${Math.round(analysis.confidence * 100)}%`
    : uploadedReceipt
      ? "업로드됨"
      : `${Math.round(analysis.confidence * 100)}%`;
  const localDate = getLocalDate(selectedDate);
  const dailyTotal = useMemo(
    () => transactions.reduce((total, item) => total + item.amount, 0),
    [transactions],
  );

  const loadTransactions = useCallback(
    async (nextLocalDate = localDate) => {
      setIsLoadingTransactions(true);
      setDatabaseError("");

      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("transactions")
        .select("*, categories(id, name), stores(name)")
        .eq("user_id", userId)
        .eq("local_date", nextLocalDate)
        .is("deleted_at", null)
        .order("occurred_at", { ascending: false });

      if (error) {
        setTransactions([]);
        setDatabaseError(error.message);
        setIsLoadingTransactions(false);
        return;
      }

      setTransactions(((data ?? []) as TransactionRow[]).map(toTransactionItem));
      setIsLoadingTransactions(false);
    },
    [localDate, userId],
  );

  useEffect(() => {
    const task = window.setTimeout(() => {
      void loadTransactions(localDate);
    }, 0);

    return () => window.clearTimeout(task);
  }, [loadTransactions, localDate]);

  async function handleReceipt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setReceiptName(file?.name ?? "");
    setUploadedReceipt(null);
    setAnalyzedReceipt(null);
    setIsReviewed(false);
    setDatabaseMessage("");
    setDatabaseError("");

    if (!file) {
      return;
    }

    setIsUploadingReceipt(true);

    const supabase = getSupabaseBrowserClient();
    const receiptId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const storagePath = `${userId}/${receiptId}/original-${sanitizeStorageFileName(
      file.name,
    )}`;

    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      setDatabaseError(uploadError.message);
      setIsUploadingReceipt(false);
      event.target.value = "";
      return;
    }

    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .insert({
        id: receiptId,
        user_id: userId,
        status: "uploaded",
        storage_path: storagePath,
        source_file_name: file.name,
        mime_type: file.type || null,
        parsed_json: {
          upload: {
            size: file.size,
            uploadedAt: new Date().toISOString(),
          },
        },
      })
      .select("id, storage_path, source_file_name")
      .single();

    if (receiptError) {
      await supabase.storage.from("receipts").remove([storagePath]);
      setDatabaseError(receiptError.message);
      setIsUploadingReceipt(false);
      event.target.value = "";
      return;
    }

    setUploadedReceipt({
      id: receipt.id,
      storagePath: receipt.storage_path,
      fileName: receipt.source_file_name ?? file.name,
    });
    setDatabaseMessage("영수증 원본을 Storage에 업로드했습니다.");
    setIsUploadingReceipt(false);
  }

  async function handleAnalyzeReceipt() {
    if (!uploadedReceipt) {
      setDatabaseError("먼저 영수증 이미지를 업로드해 주세요.");
      return;
    }

    setIsAnalyzingReceipt(true);
    setDatabaseMessage("");
    setDatabaseError("");

    const supabase = getSupabaseBrowserClient();
    const { error: processingError } = await supabase
      .from("receipts")
      .update({ status: "processing" })
      .eq("id", uploadedReceipt.id)
      .eq("user_id", userId);

    if (processingError) {
      setDatabaseError(processingError.message);
      setIsAnalyzingReceipt(false);
      return;
    }

    const response = await fetch("/api/receipts/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiptId: uploadedReceipt.id,
        storagePath: uploadedReceipt.storagePath,
        sourceName: uploadedReceipt.fileName,
      }),
    });
    const result = (await response.json()) as AnalyzeReceiptResponse;

    if (!response.ok || !result.analysis) {
      const message = result.error ?? "영수증 분석에 실패했습니다.";
      await supabase
        .from("receipts")
        .update({ status: "failed", error_message: message })
        .eq("id", uploadedReceipt.id)
        .eq("user_id", userId);
      setDatabaseError(message);
      setIsAnalyzingReceipt(false);
      return;
    }

    const { error: completedError } = await supabase
      .from("receipts")
      .update({
        status: "completed",
        country: result.analysis.country,
        language: result.analysis.language,
        currency: result.analysis.currency,
        purchased_at: result.analysis.purchasedAt,
        subtotal: result.analysis.subtotal,
        tax: result.analysis.tax,
        tip: result.analysis.tip,
        total: result.analysis.total,
        confidence: result.analysis.confidence,
        parsed_json: {
          analysis: result.analysis,
          pipeline: result.pipeline,
        },
        error_message: null,
      })
      .eq("id", uploadedReceipt.id)
      .eq("user_id", userId);

    if (completedError) {
      setDatabaseError(completedError.message);
      setIsAnalyzingReceipt(false);
      return;
    }

    setAnalyzedReceipt(result.analysis);
    setDatabaseMessage(
      result.pipeline?.provider === "mock-no-api-key"
        ? "분석 흐름을 확인했습니다. OpenAI API 키 연결 전이라 샘플 결과를 사용합니다."
        : "AI 분석이 완료되었습니다.",
    );
    setIsAnalyzingReceipt(false);
  }

  function selectSample(key: keyof typeof receiptSamples) {
    setSampleKey(key);
    setReceiptName("");
    setUploadedReceipt(null);
    setAnalyzedReceipt(null);
    setIsReviewed(false);
    setDatabaseMessage("");
    setDatabaseError("");
  }

  async function handleSaveReceipt() {
    if (requiresAnalysisBeforeSave) {
      setDatabaseError("업로드한 영수증은 AI 분석 후 확정할 수 있습니다.");
      return;
    }

    setIsSavingReceipt(true);
    setDatabaseMessage("");
    setDatabaseError("");

    const supabase = getSupabaseBrowserClient();
    const { data: category } = await supabase
      .from("categories")
      .select("id, name")
      .eq("name", "식비")
      .eq("kind", "expense")
      .eq("is_system", true)
      .maybeSingle();

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .insert({
        user_id: userId,
        name: analysis.store.name,
        address: analysis.store.address,
        phone: analysis.store.phone,
        country: analysis.country,
      })
      .select("id")
      .single();

    if (storeError) {
      setDatabaseError(storeError.message);
      setIsSavingReceipt(false);
      return;
    }

    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        category_id: category?.id ?? null,
        store_id: store.id,
        title: analysis.store.name,
        amount: analysis.total,
        currency: analysis.currency,
        occurred_at: analysis.purchasedAt,
        local_date: localDate,
        memo: `${analysis.country} 영수증 자동 저장`,
      })
      .select("id")
      .single();

    if (transactionError) {
      setDatabaseError(transactionError.message);
      setIsSavingReceipt(false);
      return;
    }

    const fallbackStoragePath = `${userId}/confirmed/${Date.now()}-${analysis.sourceName}`;
    const receiptPayload = {
      user_id: userId,
      store_id: store.id,
      transaction_id: transaction.id,
      status: "confirmed" as const,
      storage_path: uploadedReceipt?.storagePath ?? fallbackStoragePath,
      source_file_name:
        uploadedReceipt?.fileName ?? (receiptName || analysis.sourceName),
      country: analysis.country,
      language: analysis.language,
      currency: analysis.currency,
      purchased_at: analysis.purchasedAt,
      subtotal: analysis.subtotal,
      tax: analysis.tax,
      tip: analysis.tip,
      total: analysis.total,
      confidence: analysis.confidence,
      parsed_json: analysis,
    };
    const receiptRequest = uploadedReceipt
      ? supabase
          .from("receipts")
          .update(receiptPayload)
          .eq("id", uploadedReceipt.id)
          .eq("user_id", userId)
          .select("id")
          .single()
      : supabase
          .from("receipts")
          .insert({
            ...receiptPayload,
            storage_path: fallbackStoragePath,
          })
          .select("id")
          .single();
    const { data: receipt, error: receiptError } = await receiptRequest;

    if (receiptError) {
      setDatabaseError(receiptError.message);
      setIsSavingReceipt(false);
      return;
    }

    const { error: itemsError } = await supabase.from("receipt_items").insert(
      analysis.items.map((item, index) => ({
        receipt_id: receipt.id,
        user_id: userId,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
        currency: analysis.currency,
        line_index: index,
        confidence: analysis.confidence,
      })),
    );

    if (itemsError) {
      setDatabaseError(itemsError.message);
      setIsSavingReceipt(false);
      return;
    }

    setIsReviewed(true);
    setDatabaseMessage("Supabase에 저장됐습니다.");
    await loadTransactions(localDate);
    setIsSavingReceipt(false);
  }

  return (
    <main className="min-h-dvh bg-[#f6f1e7] text-[#14221f]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#fdfbf6] shadow-2xl shadow-black/10">
        <header className="px-5 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#5e746f]">
                Budget Book
              </p>
              <h1 className="mt-2 text-2xl font-bold">오늘의 가계부</h1>
            </div>
            <button
              type="button"
              onClick={async () => {
                setIsSigningOut(true);
                await onSignOut();
                setIsSigningOut(false);
              }}
              className="grid size-11 place-items-center rounded-lg border border-[#d9d0bf] bg-white text-[#14221f]"
              aria-label="로그아웃"
              title="로그아웃"
            >
              {isSigningOut ? <Settings size={20} /> : <LogOut size={20} />}
            </button>
          </div>
          <p className="mt-3 truncate text-xs font-semibold text-[#5e746f]">
            {userEmail}
          </p>
        </header>

        <section className="px-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="grid size-9 place-items-center rounded-lg border border-[#d9d0bf] bg-white"
              aria-label="이전 주"
              title="이전 주"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays size={17} />
              2026년 7월
            </div>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-lg border border-[#d9d0bf] bg-white"
              aria-label="다음 주"
              title="다음 주"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2">
            {calendarDays.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDate(day)}
                className={`flex h-14 flex-col items-center justify-center rounded-lg border text-sm transition ${
                  selectedDate === day
                    ? "border-[#10231f] bg-[#10231f] text-white"
                    : "border-[#e3dac8] bg-white text-[#5e746f]"
                }`}
              >
                <span className="text-[11px]">월</span>
                <span className="font-bold">{day}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5 px-5">
          <div className="rounded-lg bg-[#10231f] p-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[#b8c8c3]">7월 {selectedDate}일 지출</p>
                <p className="mt-2 text-3xl font-bold">{money.format(dailyTotal)}원</p>
              </div>
              <div className="rounded-lg bg-[#2f9f8f] px-3 py-2 text-sm font-bold">
                예산 68%
              </div>
            </div>
            <div className="mt-5 h-2 rounded-full bg-white/15">
              <div className="h-2 w-[68%] rounded-full bg-[#f3bf4f]" />
            </div>
          </div>
        </section>

        <section className="mt-6 flex-1 px-5 pb-28">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">내역</h2>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-lg bg-[#2f9f8f] text-white"
              aria-label="직접 입력"
              title="직접 입력"
            >
              <Plus size={19} />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {databaseError ? (
              <div className="rounded-lg border border-[#e6ddcb] bg-white p-4 text-sm font-semibold text-[#b15e32]">
                {databaseError}
              </div>
            ) : null}

            {isLoadingTransactions ? (
              <div className="rounded-lg border border-[#e6ddcb] bg-white p-4 text-sm font-semibold text-[#63746f]">
                내역을 불러오는 중
              </div>
            ) : null}

            {!isLoadingTransactions && transactions.length === 0 ? (
              <div className="rounded-lg border border-[#e6ddcb] bg-white p-4 text-sm leading-6 text-[#63746f]">
                아직 저장된 내역이 없습니다. 영수증 분석 결과를 확정하면 이 날짜에 추가됩니다.
              </div>
            ) : null}

            {transactions.map((item) => (
              <article
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-[#e6ddcb] bg-white p-3"
              >
                <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#e8f3ef] text-[#257d72]">
                  <WalletCards size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-semibold">{item.title}</p>
                    <p className="shrink-0 font-bold">
                      -{money.format(item.amount)}원
                    </p>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[#6d766f]">
                    <span>{item.place}</span>
                    <span>{item.category}</span>
                    <span>{item.time}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 border-t border-[#e2d8c7] pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">글로벌 영수증 분석</h2>
                <p className="mt-1 text-sm text-[#63746f]">
                  국가, 언어, 통화, 세금과 팁까지 구분합니다.
                </p>
              </div>
              <label
                className={`grid size-11 place-items-center rounded-lg bg-[#f3bf4f] text-[#10231f] ${
                  isUploadingReceipt ? "cursor-wait opacity-70" : "cursor-pointer"
                }`}
                aria-label="영수증 첨부"
                title="영수증 첨부"
              >
                <Camera size={21} />
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={isUploadingReceipt}
                  onChange={handleReceipt}
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {sampleTabs.map((sample) => (
                <button
                  key={sample.key}
                  type="button"
                  onClick={() => selectSample(sample.key)}
                  className={`h-10 rounded-lg border text-sm font-bold ${
                    sampleKey === sample.key
                      ? "border-[#10231f] bg-[#10231f] text-white"
                      : "border-[#d8cebb] bg-white text-[#5e746f]"
                  }`}
                >
                  {sample.label}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-[#d8cebb] bg-[#fffaf0] p-4">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-[#b15e32]">
                  <ReceiptText size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {receiptName || analysis.sourceName}
                  </p>
                  <p className="mt-1 text-sm text-[#6f756b]">
                    {receiptStatusLabel}
                  </p>
                </div>
                <div className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-[#257d72]">
                  {receiptBadgeLabel}
                </div>
              </div>

              {uploadedReceipt ? (
                <div className="mt-3 rounded-lg bg-white p-3 text-xs leading-5 text-[#5f6d67]">
                  <p className="font-bold text-[#257d72]">Storage path</p>
                  <p className="break-all">{uploadedReceipt.storagePath}</p>
                </div>
              ) : null}

              {uploadedReceipt ? (
                <button
                  type="button"
                  onClick={handleAnalyzeReceipt}
                  disabled={isAnalyzingReceipt || isSavingReceipt || isReviewed}
                  className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#10231f] bg-white text-sm font-bold text-[#10231f] disabled:cursor-not-allowed disabled:border-[#b5bdb8] disabled:text-[#8a958f]"
                >
                  <Sparkles size={17} />
                  {isAnalyzingReceipt
                    ? "분석 중"
                    : analyzedReceipt
                      ? "재분석하기"
                      : "AI 분석하기"}
                </button>
              ) : null}

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-white p-2">
                  <Globe2 size={15} className="mb-1 text-[#257d72]" />
                  <p className="font-bold">{analysis.country}</p>
                </div>
                <div className="rounded-lg bg-white p-2">
                  <Languages size={15} className="mb-1 text-[#257d72]" />
                  <p className="font-bold">{analysis.language}</p>
                </div>
                <div className="rounded-lg bg-white p-2">
                  <WalletCards size={15} className="mb-1 text-[#257d72]" />
                  <p className="font-bold">{analysis.currency}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Store size={16} className="text-[#257d72]" />
                  <span className="font-semibold">{analysis.store.name}</span>
                </div>
                <div className="flex items-center gap-2 text-[#5f6d67]">
                  <MapPin size={16} />
                  <span>{analysis.store.address}</span>
                </div>
                <div className="flex items-center gap-2 text-[#5f6d67]">
                  <Search size={16} />
                  <span>{analysis.store.phone}</span>
                </div>
              </div>

              <div className="mt-4 divide-y divide-[#eadfc9]">
                {analysis.items.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate">{item.name}</p>
                      <p className="mt-0.5 text-xs text-[#6f756b]">
                        {item.quantity}개 x{" "}
                        {formatReceiptMoney(item.unitPrice, analysis.currency)}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold">
                      {formatReceiptMoney(item.totalPrice, analysis.currency)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2 border-t border-[#eadfc9] pt-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>소계</span>
                  <span>{formatReceiptMoney(analysis.subtotal, analysis.currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>세금</span>
                  <span>{formatReceiptMoney(analysis.tax, analysis.currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>팁/서비스차지</span>
                  <span>{formatReceiptMoney(analysis.tip, analysis.currency)}</span>
                </div>
                <div className="flex items-center justify-between pt-1 text-base font-bold">
                  <span>합계</span>
                  <span>{formatReceiptMoney(analysis.total, analysis.currency)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveReceipt}
                disabled={
                  isSavingReceipt ||
                  isUploadingReceipt ||
                  isAnalyzingReceipt ||
                  requiresAnalysisBeforeSave ||
                  isReviewed
                }
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#10231f] text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#8a958f]"
              >
                <Check size={17} />
                {isSavingReceipt
                  ? "저장 중"
                  : isReviewed
                    ? "확정됨"
                    : requiresAnalysisBeforeSave
                      ? "분석 후 확정 가능"
                    : "확정하고 가계부에 저장"}
              </button>

              {databaseMessage ? (
                <p className="mt-3 text-sm font-semibold text-[#257d72]">
                  {databaseMessage}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <nav className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[430px] border-t border-[#e5dccb] bg-[#fdfbf6]/95 px-5 pb-4 pt-3 backdrop-blur">
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "홈", icon: Home, active: true },
              { label: "작성", icon: NotebookPen, active: false },
              { label: "영수증", icon: ReceiptText, active: false },
              { label: "검색", icon: Search, active: false },
            ].map(({ label, icon: Icon, active }) => (
              <button
                key={label}
                type="button"
                className={`flex h-12 flex-col items-center justify-center rounded-lg text-xs font-semibold ${
                  active ? "bg-[#e6f4ef] text-[#1d7468]" : "text-[#7a7f78]"
                }`}
              >
                <Icon size={18} />
                <span className="mt-1">{label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </main>
  );
}

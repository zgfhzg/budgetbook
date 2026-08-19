"use client";

import {
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Globe2,
  Home,
  ImageUp,
  Languages,
  MapPin,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Sparkles,
  Settings,
  Store,
  LogOut,
  WalletCards,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  formatReceiptMoney,
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
type StoreOptionRow = Pick<
  Database["public"]["Tables"]["stores"]["Row"],
  "id" | "name" | "address"
>;
type ReceiptRow = Pick<
  Database["public"]["Tables"]["receipts"]["Row"],
  | "id"
  | "status"
  | "storage_path"
  | "source_file_name"
  | "country"
  | "currency"
  | "total"
  | "created_at"
>;

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
  ocrText?: string;
  pipeline?: {
    provider?: string;
  };
  error?: string;
};

type AppTab = "home" | "receipts" | "search";

const manualCategories = ["식비", "카페", "교통", "생활", "의료"] as const;
const manualCurrencies = ["KRW", "HKD"] as const;

const money = new Intl.NumberFormat("ko-KR");

type BudgetAppProps = {
  userId: string;
  userEmail: string;
  onSignOut: () => Promise<void>;
};

function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function getCurrentDate() {
  return formatLocalDate(new Date());
}

function getWeekDays(selectedLocalDate: string) {
  const selectedDate = parseLocalDate(selectedLocalDate);
  const sunday = addDays(selectedDate, -selectedDate.getDay());
  const formatter = new Intl.DateTimeFormat("ko-KR", { weekday: "short" });

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(sunday, index);
    return {
      date: formatLocalDate(date),
      day: String(date.getDate()).padStart(2, "0"),
      weekday: formatter.format(date),
    };
  });
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
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [selectedDate, setSelectedDate] = useState(getCurrentDate);
  const [receiptName, setReceiptName] = useState("");
  const [uploadedReceipt, setUploadedReceipt] = useState<UploadedReceipt | null>(
    null,
  );
  const [analyzedReceipt, setAnalyzedReceipt] = useState<ReceiptAnalysis | null>(
    null,
  );
  const [isReviewed, setIsReviewed] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualCategory, setManualCategory] =
    useState<(typeof manualCategories)[number]>("식비");
  const [manualCurrency, setManualCurrency] =
    useState<(typeof manualCurrencies)[number]>("KRW");
  const [manualStoreId, setManualStoreId] = useState<string | null>(null);
  const [manualPlace, setManualPlace] = useState("");
  const [manualTime, setManualTime] = useState("12:00");
  const [manualMemo, setManualMemo] = useState("");
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(false);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isAnalyzingReceipt, setIsAnalyzingReceipt] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);
  const [databaseMessage, setDatabaseMessage] = useState("");
  const [databaseError, setDatabaseError] = useState("");
  const [storeOptions, setStoreOptions] = useState<StoreOptionRow[]>([]);

  const calendarDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const calendarTitle = useMemo(() => {
    const [startDay, endDay] = [calendarDays[0], calendarDays[6]];
    const startDate = parseLocalDate(startDay.date);
    const endDate = parseLocalDate(endDay.date);

    if (startDate.getMonth() === endDate.getMonth()) {
      return `${startDate.getFullYear()}년 ${startDate.getMonth() + 1}월`;
    }

    return `${startDate.getMonth() + 1}월 ${startDay.day}일 - ${
      endDate.getMonth() + 1
    }월 ${endDay.day}일`;
  }, [calendarDays]);
  const localDate = selectedDate;
  const analysis = analyzedReceipt;
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
            : "영수증 대기";
  const receiptBadgeLabel = analyzedReceipt
    ? `${Math.round(analyzedReceipt.confidence * 100)}%`
    : uploadedReceipt
      ? "업로드됨"
      : "대기";
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

  const loadReceipts = useCallback(async () => {
    setIsLoadingReceipts(true);
    setDatabaseError("");

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("receipts")
      .select(
        "id, status, storage_path, source_file_name, country, currency, total, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      setReceipts([]);
      setDatabaseError(error.message);
      setIsLoadingReceipts(false);
      return;
    }

    setReceipts(data ?? []);
    setIsLoadingReceipts(false);
  }, [userId]);

  const loadStoreOptions = useCallback(async () => {
    setIsLoadingStores(true);

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("stores")
      .select("id, name, address")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (!error) {
      setStoreOptions(data ?? []);
    }

    setIsLoadingStores(false);
  }, [userId]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void loadTransactions(localDate);
    }, 0);

    return () => window.clearTimeout(task);
  }, [loadTransactions, localDate]);

  function changeTab(nextTab: AppTab) {
    setActiveTab(nextTab);
    setDatabaseMessage("");
    setDatabaseError("");

    if (nextTab === "receipts") {
      void loadReceipts();
    }
  }

  function openManualForm() {
    setIsManualFormOpen(true);
    setDatabaseMessage("");
    setDatabaseError("");
    void loadStoreOptions();
  }

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

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setDatabaseError("로그인 세션을 다시 확인해 주세요.");
      setIsAnalyzingReceipt(false);
      return;
    }

    const response = await fetch("/api/receipts/analyze", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
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
        ocr_text: result.ocrText ?? null,
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
      result.pipeline?.provider === "text-parser"
        ? "텍스트 기반 분석이 완료되었습니다."
        : "AI 분석이 완료되었습니다.",
    );
    setIsAnalyzingReceipt(false);
  }

  function resetManualForm() {
    setManualTitle("");
    setManualAmount("");
    setManualCategory("식비");
    setManualCurrency("KRW");
    setManualStoreId(null);
    setManualPlace("");
    setManualTime("12:00");
    setManualMemo("");
  }

  function selectManualStore(store: StoreOptionRow) {
    setManualStoreId(store.id);
    setManualPlace(store.name);
  }

  async function handleSaveManualTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDatabaseMessage("");
    setDatabaseError("");

    const normalizedTitle = manualTitle.trim();
    const normalizedAmount = Number(manualAmount.replace(/,/g, ""));
    const normalizedPlace = manualPlace.trim();

    if (!normalizedTitle) {
      setDatabaseError("내역명을 입력해 주세요.");
      return;
    }

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setDatabaseError("금액을 0보다 크게 입력해 주세요.");
      return;
    }

    setIsSavingManual(true);

    const supabase = getSupabaseBrowserClient();
    const { data: category } = await supabase
      .from("categories")
      .select("id, name")
      .eq("name", manualCategory)
      .eq("kind", "expense")
      .maybeSingle();

    let storeId: string | null = null;
    if (manualStoreId) {
      storeId = manualStoreId;
    } else if (normalizedPlace) {
      const existingStore = storeOptions.find(
        (store) => store.name.trim().toLowerCase() === normalizedPlace.toLowerCase(),
      );

      if (existingStore) {
        storeId = existingStore.id;
      } else {
        const { data: store, error: storeError } = await supabase
          .from("stores")
          .insert({
            user_id: userId,
            name: normalizedPlace,
          })
          .select("id")
          .single();

        if (storeError) {
          setDatabaseError(storeError.message);
          setIsSavingManual(false);
          return;
        }

        storeId = store.id;
      }
    }

    const occurredAt = new Date(`${localDate}T${manualTime}:00`).toISOString();
    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      category_id: category?.id ?? null,
      store_id: storeId,
      kind: "expense",
      title: normalizedTitle,
      amount: normalizedAmount,
      currency: manualCurrency,
      occurred_at: occurredAt,
      local_date: localDate,
      memo: manualMemo.trim() || null,
    });

    if (error) {
      setDatabaseError(error.message);
      setIsSavingManual(false);
      return;
    }

    resetManualForm();
    setIsManualFormOpen(false);
    setDatabaseMessage("수기 내역을 저장했습니다.");
    await loadTransactions(localDate);
    await loadStoreOptions();
    setIsSavingManual(false);
  }

  async function handleSaveReceipt() {
    if (!analysis) {
      setDatabaseError("분석 완료 후 저장할 수 있습니다.");
      return;
    }

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

        <div className={activeTab === "home" ? "" : "hidden"}>
          <section className="px-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setSelectedDate(formatLocalDate(addDays(parseLocalDate(selectedDate), -7)))
              }
              className="grid size-9 place-items-center rounded-lg border border-[#d9d0bf] bg-white"
              aria-label="이전 주"
              title="이전 주"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays size={17} />
              {calendarTitle}
            </div>
            <button
              type="button"
              onClick={() =>
                setSelectedDate(formatLocalDate(addDays(parseLocalDate(selectedDate), 7)))
              }
              className="grid size-9 place-items-center rounded-lg border border-[#d9d0bf] bg-white"
              aria-label="다음 주"
              title="다음 주"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2">
            {calendarDays.map(({ date, day, weekday }) => (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={`flex h-14 flex-col items-center justify-center rounded-lg border text-sm transition ${
                  selectedDate === date
                    ? "border-[#10231f] bg-[#10231f] text-white"
                    : "border-[#e3dac8] bg-white text-[#5e746f]"
                }`}
              >
                <span className="text-[11px]">{weekday}</span>
                <span className="font-bold">{day}</span>
              </button>
            ))}
          </div>
        </section>

          <section className="mt-5 px-5">
          <div className="rounded-lg bg-[#10231f] p-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[#b8c8c3]">{localDate} 지출</p>
                <p className="mt-2 text-3xl font-bold">{money.format(dailyTotal)}원</p>
              </div>
            </div>
            <div className="mt-5 h-2 rounded-full bg-white/15">
              <div className="h-2 w-0 rounded-full bg-[#f3bf4f]" />
            </div>
          </div>
        </section>

          <section className="mt-6 flex-1 px-5 pb-28">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">내역</h2>
            <button
              type="button"
              onClick={openManualForm}
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
              <div className="flex gap-2">
                <label
                  className={`grid size-11 place-items-center rounded-lg bg-white text-[#10231f] ring-1 ring-[#d9d0bf] ${
                    isUploadingReceipt ? "cursor-wait opacity-70" : "cursor-pointer"
                  }`}
                  aria-label="사진 선택"
                  title="사진 선택"
                >
                  <ImageUp size={21} />
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    disabled={isUploadingReceipt}
                    onChange={handleReceipt}
                  />
                </label>
                <label
                  className={`grid size-11 place-items-center rounded-lg bg-[#f3bf4f] text-[#10231f] ${
                    isUploadingReceipt ? "cursor-wait opacity-70" : "cursor-pointer"
                  }`}
                  aria-label="카메라 촬영"
                  title="카메라 촬영"
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
            </div>

            <div className="mt-4 rounded-lg border border-[#d8cebb] bg-[#fffaf0] p-4">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-[#b15e32]">
                  <ReceiptText size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {receiptName || "영수증 이미지"}
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

              {analysis ? (
                <>
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
                </>
              ) : null}

              <button
                type="button"
                onClick={handleSaveReceipt}
                disabled={
                  isSavingReceipt ||
                  isUploadingReceipt ||
                  isAnalyzingReceipt ||
                  !analysis ||
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
                    : !analysis || requiresAnalysisBeforeSave
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
        </div>

        <div className={activeTab === "receipts" ? "" : "hidden"}>
          <section className="px-5 pb-28">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">영수증 보관함</h2>
                <p className="mt-1 text-sm text-[#63746f]">
                  업로드한 원본과 분석 상태
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadReceipts()}
                className="grid size-10 place-items-center rounded-lg border border-[#d9d0bf] bg-white"
                aria-label="새로고침"
                title="새로고침"
              >
                <RefreshCw size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {databaseError ? (
                <div className="rounded-lg border border-[#e6ddcb] bg-white p-4 text-sm font-semibold text-[#b15e32]">
                  {databaseError}
                </div>
              ) : null}

              {isLoadingReceipts ? (
                <div className="rounded-lg border border-[#e6ddcb] bg-white p-4 text-sm font-semibold text-[#63746f]">
                  영수증을 불러오는 중
                </div>
              ) : null}

              {!isLoadingReceipts && receipts.length === 0 ? (
                <div className="rounded-lg border border-[#e6ddcb] bg-white p-4 text-sm leading-6 text-[#63746f]">
                  아직 업로드한 영수증이 없습니다.
                </div>
              ) : null}

              {receipts.map((receipt) => (
                <article
                  key={receipt.id}
                  className="rounded-lg border border-[#e6ddcb] bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">
                        {receipt.source_file_name ?? "영수증 이미지"}
                      </p>
                      <p className="mt-1 text-xs text-[#63746f]">
                        {new Intl.DateTimeFormat("ko-KR", {
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(receipt.created_at))}
                      </p>
                    </div>
                    <span className="rounded-lg bg-[#e8f3ef] px-2 py-1 text-xs font-bold text-[#257d72]">
                      {receipt.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-[#fffaf0] p-2">
                      <p className="font-bold text-[#5e746f]">국가</p>
                      <p className="mt-1">{receipt.country ?? "분석 전"}</p>
                    </div>
                    <div className="rounded-lg bg-[#fffaf0] p-2">
                      <p className="font-bold text-[#5e746f]">금액</p>
                      <p className="mt-1">
                        {receipt.total && receipt.currency
                          ? formatReceiptMoney(Number(receipt.total), receipt.currency)
                          : "분석 전"}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 break-all rounded-lg bg-[#fffaf0] p-2 text-xs leading-5 text-[#5f6d67]">
                    {receipt.storage_path}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className={activeTab === "search" ? "" : "hidden"}>
          <section className="px-5 pb-28">
            <h2 className="text-xl font-bold">검색</h2>
            <div className="mt-4 rounded-lg border border-[#e6ddcb] bg-white p-4 text-sm leading-6 text-[#63746f]">
              검색 준비 중
            </div>
          </section>
        </div>

        <nav className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[430px] border-t border-[#e5dccb] bg-[#fdfbf6]/95 px-5 pb-4 pt-3 backdrop-blur">
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "home" as const, label: "홈", icon: Home },
              { key: "receipts" as const, label: "영수증", icon: ReceiptText },
              { key: "search" as const, label: "검색", icon: Search },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => changeTab(key)}
                className={`flex h-12 flex-col items-center justify-center rounded-lg text-xs font-semibold ${
                  activeTab === key ? "bg-[#e6f4ef] text-[#1d7468]" : "text-[#7a7f78]"
                }`}
              >
                <Icon size={18} />
                <span className="mt-1">{label}</span>
              </button>
            ))}
          </div>
        </nav>

        {isManualFormOpen ? (
          <div className="fixed inset-0 z-20 bg-[#10231f]/45 px-4 py-5">
            <div className="mx-auto flex h-full w-full max-w-[430px] items-end">
              <section className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg bg-[#fdfbf6] p-5 shadow-2xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5e746f]">
                      Manual Entry
                    </p>
                    <h2 className="mt-1 text-xl font-bold">수기 내역 추가</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualFormOpen(false);
                      resetManualForm();
                    }}
                    className="grid size-10 place-items-center rounded-lg border border-[#d9d0bf] bg-white"
                    aria-label="닫기"
                    title="닫기"
                  >
                    <X size={19} />
                  </button>
                </div>

                <form className="mt-5 space-y-4" onSubmit={handleSaveManualTransaction}>
                  <div>
                    <label className="text-sm font-bold" htmlFor="manual-title">
                      내역명
                    </label>
                    <input
                      id="manual-title"
                      value={manualTitle}
                      onChange={(event) => setManualTitle(event.target.value)}
                      className="mt-2 h-11 w-full rounded-lg border border-[#d8cebb] bg-white px-3 text-base outline-none focus:border-[#2f9f8f]"
                      placeholder="예: 점심, 커피, 택시"
                    />
                  </div>

                  <div className="grid grid-cols-[1fr_104px] gap-3">
                    <div>
                      <label className="text-sm font-bold" htmlFor="manual-amount">
                        금액
                      </label>
                      <div className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-[#d8cebb] bg-white px-3 focus-within:border-[#2f9f8f]">
                        <CircleDollarSign size={17} className="text-[#257d72]" />
                        <input
                          id="manual-amount"
                          value={manualAmount}
                          onChange={(event) => setManualAmount(event.target.value)}
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          className="min-w-0 flex-1 bg-transparent text-base outline-none"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-bold" htmlFor="manual-currency">
                        통화
                      </label>
                      <select
                        id="manual-currency"
                        value={manualCurrency}
                        onChange={(event) =>
                          setManualCurrency(
                            event.target.value as (typeof manualCurrencies)[number],
                          )
                        }
                        className="mt-2 h-11 w-full rounded-lg border border-[#d8cebb] bg-white px-3 text-sm font-bold outline-none focus:border-[#2f9f8f]"
                      >
                        {manualCurrencies.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-bold" htmlFor="manual-category">
                        카테고리
                      </label>
                      <select
                        id="manual-category"
                        value={manualCategory}
                        onChange={(event) =>
                          setManualCategory(
                            event.target.value as (typeof manualCategories)[number],
                          )
                        }
                        className="mt-2 h-11 w-full rounded-lg border border-[#d8cebb] bg-white px-3 text-sm font-bold outline-none focus:border-[#2f9f8f]"
                      >
                        {manualCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-bold" htmlFor="manual-time">
                        시간
                      </label>
                      <input
                        id="manual-time"
                        type="time"
                        value={manualTime}
                        onChange={(event) => setManualTime(event.target.value)}
                        className="mt-2 h-11 w-full rounded-lg border border-[#d8cebb] bg-white px-3 text-sm font-bold outline-none focus:border-[#2f9f8f]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-bold" htmlFor="manual-place">
                      장소
                    </label>
                    <input
                      id="manual-place"
                      value={manualPlace}
                      onChange={(event) => {
                        setManualPlace(event.target.value);
                        setManualStoreId(null);
                      }}
                      className="mt-2 h-11 w-full rounded-lg border border-[#d8cebb] bg-white px-3 text-base outline-none focus:border-[#2f9f8f]"
                      placeholder="선택 입력"
                    />
                    {isLoadingStores ? (
                      <p className="mt-2 text-xs font-semibold text-[#63746f]">
                        장소 불러오는 중
                      </p>
                    ) : null}
                    {!isLoadingStores && storeOptions.length > 0 ? (
                      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                        {storeOptions.map((store) => (
                          <button
                            key={store.id}
                            type="button"
                            onClick={() => selectManualStore(store)}
                            className={`min-w-28 rounded-lg border px-3 py-2 text-left text-xs ${
                              manualStoreId === store.id
                                ? "border-[#10231f] bg-[#10231f] text-white"
                                : "border-[#d8cebb] bg-white text-[#5e746f]"
                            }`}
                          >
                            <span className="block truncate font-bold">{store.name}</span>
                            {store.address ? (
                              <span className="mt-1 block truncate">{store.address}</span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <label className="text-sm font-bold" htmlFor="manual-memo">
                      메모
                    </label>
                    <textarea
                      id="manual-memo"
                      value={manualMemo}
                      onChange={(event) => setManualMemo(event.target.value)}
                      className="mt-2 min-h-20 w-full resize-none rounded-lg border border-[#d8cebb] bg-white px-3 py-2 text-base outline-none focus:border-[#2f9f8f]"
                      placeholder="선택 입력"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingManual}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#10231f] text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#8a958f]"
                  >
                    <Check size={17} />
                    {isSavingManual ? "저장 중" : "저장"}
                  </button>
                </form>
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

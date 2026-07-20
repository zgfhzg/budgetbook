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
  Settings,
  Store,
  WalletCards,
} from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import {
  formatReceiptMoney,
  receiptSamples,
  type ReceiptAnalysis,
} from "@/lib/receiptAnalysis";

type Transaction = {
  id: number;
  title: string;
  place: string;
  amount: number;
  category: string;
  time: string;
};

const transactions: Transaction[] = [
  {
    id: 1,
    title: "아이스 아메리카노",
    place: "모닝브루 성수점",
    amount: 4500,
    category: "카페",
    time: "09:18",
  },
  {
    id: 2,
    title: "점심 정식",
    place: "소담식탁",
    amount: 12800,
    category: "식비",
    time: "12:42",
  },
  {
    id: 3,
    title: "지하철",
    place: "교통카드",
    amount: 1550,
    category: "교통",
    time: "19:03",
  },
];

const sampleTabs = [
  { key: "korea", label: "한국" },
  { key: "usa", label: "미국" },
  { key: "japan", label: "일본" },
] as const;

const money = new Intl.NumberFormat("ko-KR");

export function BudgetApp() {
  const [selectedDate, setSelectedDate] = useState("20");
  const [receiptName, setReceiptName] = useState("");
  const [sampleKey, setSampleKey] = useState<keyof typeof receiptSamples>("usa");
  const [isReviewed, setIsReviewed] = useState(false);

  const analysis: ReceiptAnalysis = receiptSamples[sampleKey];
  const dailyTotal = useMemo(
    () => transactions.reduce((total, item) => total + item.amount, 0),
    [],
  );

  function handleReceipt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setReceiptName(file?.name ?? "");
    setIsReviewed(false);
  }

  function selectSample(key: keyof typeof receiptSamples) {
    setSampleKey(key);
    setReceiptName("");
    setIsReviewed(false);
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
              className="grid size-11 place-items-center rounded-lg border border-[#d9d0bf] bg-white text-[#14221f]"
              aria-label="설정"
              title="설정"
            >
              <Settings size={20} />
            </button>
          </div>
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
            {["16", "17", "18", "19", "20", "21", "22"].map((day) => (
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
                className="grid size-11 cursor-pointer place-items-center rounded-lg bg-[#f3bf4f] text-[#10231f]"
                aria-label="영수증 첨부"
                title="영수증 첨부"
              >
                <Camera size={21} />
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleReceipt}
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
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
                    {receiptName ? "OCR 연결 대기 - 구조화 준비됨" : "샘플 분석 결과"}
                  </p>
                </div>
                <div className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-[#257d72]">
                  {Math.round(analysis.confidence * 100)}%
                </div>
              </div>

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
                onClick={() => setIsReviewed(true)}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#10231f] text-sm font-bold text-white"
              >
                <Check size={17} />
                {isReviewed ? "확정됨" : "확정하고 가계부에 저장"}
              </button>
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

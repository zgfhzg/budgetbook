"use client";

import {
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Home,
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

const extractedItems = [
  { name: "우유 900ml", price: 2980 },
  { name: "계란 10구", price: 5490 },
  { name: "바나나", price: 3980 },
  { name: "종량제 봉투", price: 760 },
];

const money = new Intl.NumberFormat("ko-KR");

export function BudgetApp() {
  const [selectedDate, setSelectedDate] = useState("20");
  const [receiptName, setReceiptName] = useState("");
  const [isReviewed, setIsReviewed] = useState(false);

  const dailyTotal = useMemo(
    () => transactions.reduce((total, item) => total + item.amount, 0),
    [],
  );
  const receiptTotal = useMemo(
    () => extractedItems.reduce((total, item) => total + item.price, 0),
    [],
  );

  function handleReceipt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setReceiptName(file?.name ?? "");
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
                <h2 className="text-lg font-bold">영수증 분석</h2>
                <p className="mt-1 text-sm text-[#63746f]">
                  사진 첨부 후 점포와 품목을 확인하세요.
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

            <div className="mt-4 rounded-lg border border-[#d8cebb] bg-[#fffaf0] p-4">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-[#b15e32]">
                  <ReceiptText size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {receiptName || "emart-receipt.jpg"}
                  </p>
                  <p className="mt-1 text-sm text-[#6f756b]">
                    {receiptName ? "분석 대기" : "샘플 분석 결과"}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Store size={16} className="text-[#257d72]" />
                  <span className="font-semibold">이마트24 성수포레점</span>
                </div>
                <div className="flex items-center gap-2 text-[#5f6d67]">
                  <MapPin size={16} />
                  <span>서울 성동구 왕십리로 96</span>
                </div>
                <div className="flex items-center gap-2 text-[#5f6d67]">
                  <Search size={16} />
                  <span>02-1234-5678</span>
                </div>
              </div>

              <div className="mt-4 divide-y divide-[#eadfc9]">
                {extractedItems.map((item) => (
                  <div key={item.name} className="flex items-center justify-between py-2">
                    <span>{item.name}</span>
                    <span className="font-semibold">{money.format(item.price)}원</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#eadfc9] pt-3">
                <p className="font-bold">합계 {money.format(receiptTotal)}원</p>
                <button
                  type="button"
                  onClick={() => setIsReviewed(true)}
                  className="flex h-10 items-center gap-2 rounded-lg bg-[#10231f] px-4 text-sm font-bold text-white"
                >
                  <Check size={17} />
                  {isReviewed ? "확정됨" : "확정"}
                </button>
              </div>
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

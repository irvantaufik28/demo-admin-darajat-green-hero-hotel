"use client";
import "../../dashboard/styles/dashboard.css";
import "../styles/reservations.css";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "../../../components/layout/AdminShell";
import { inHouseGuests, type InHouseRecord } from "../constants/in-house-data";
import {
  calculateNights,
  extraBedRates as roomExtraBedRates,
  extras,
  formatRupiah,
  getExtraCost,
  roomTypes,
} from "../constants/walk-in-data";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

type ModalKind =
  | "payment"
  | "extend"
  | "checkout"
  | "extra"
  | "room"
  | "bed"
  | null;
type StayState = InHouseRecord["operationalStatus"] | "Checked Out";
type AddedExtra = {
  id: string;
  quantity: number;
  nights: number;
  amount: number;
  paymentChoice: "pending" | "later" | "paid";
};
type RoomAdjustment = {
  id: string;
  roomKey: string;
  from: string;
  to: string;
  amount: number;
  bedDelta: number;
  nights: number;
  paymentChoice: "pending" | "later" | "paid";
};
type AssignedRoom = {
  key: string;
  name: string;
  number: string;
  adults: number;
  bed?: {
    nights: number;
    amount: number;
    chargeAmount: number;
    paymentChoice: "pending" | "later" | "paid";
  };
};
const extraBedRates: Record<string, number> = Object.fromEntries(
  roomTypes.map((room) => [room.name, roomExtraBedRates[room.id]]),
);
const experienceOptions = extras.filter((item) => item.id !== "extra-bed");

function dateLabel(value: string) {
  const date = new Date(value + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="guest-stay-section">
      <div className="guest-stay-section-head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="guest-stay-info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function InHouseDetailPage() {
  const { t } = useTranslations({ en, id });
  const { bookingId } = useParams<{ bookingId: string }>();
  const guest = inHouseGuests.find((item) => item.bookingId === bookingId);

  return (
    <AdminShell title={t("shell.title")} context={t("shell.inHouse")}>
      {guest ? (
        <GuestStay key={guest.bookingId} guest={guest} />
      ) : (
        <div className="guest-stay-page">
          <h1>{t("inHouseDetail.notFound")}</h1>
          <Link href="/reservations/in-house">← {t("inHouseDetail.backInHouse")}</Link>
        </div>
      )}
    </AdminShell>
  );
}

function GuestStay({ guest }: { guest: InHouseRecord }) {
  const { t } = useTranslations({ en, id });
  const [amountPaid, setAmountPaid] = useState(guest.amountPaid);
  const [total, setTotal] = useState(guest.total);
  const [billTotal, setBillTotal] = useState(guest.total);
  const [checkOut, setCheckOut] = useState(guest.checkOut);
  const [assignedRooms, setAssignedRooms] = useState<AssignedRoom[]>(() =>
    (
      guest.rooms ?? [
        {
          room: guest.room,
          roomNumber: guest.roomNumber,
          adults: guest.adults,
        },
      ]
    ).map((room, index) => ({
      key: `assigned-${index}`,
      name: room.room,
      number: room.roomNumber,
      adults: room.adults,
      bed: room.extraBedNights
        ? {
            nights: room.extraBedNights,
            amount: (extraBedRates[room.room] ?? 150000) * room.extraBedNights,
            chargeAmount:
              guest.paymentStatus === "Paid"
                ? 0
                : (extraBedRates[room.room] ?? 150000) * room.extraBedNights,
            paymentChoice:
              guest.paymentStatus === "Paid"
                ? ("paid" as const)
                : ("later" as const),
          }
        : undefined,
    })),
  );
  const [activeRoomKey, setActiveRoomKey] = useState("assigned-0");
  const [roomAdjustments, setRoomAdjustments] = useState<RoomAdjustment[]>([]);
  const [selectedRoomNumber, setSelectedRoomNumber] = useState("");
  const [roomChangeNights, setRoomChangeNights] = useState(
    guest.operationalStatus === "In House" ? 2 : 1,
  );
  const [bedNights, setBedNights] = useState(
    guest.operationalStatus === "In House" ? 2 : 1,
  );
  const [bedEnabled, setBedEnabled] = useState(true);
  const [stayState, setStayState] = useState<StayState>(
    guest.operationalStatus,
  );
  const [modal, setModal] = useState<ModalKind>(null);
  const [paymentInput, setPaymentInput] = useState("");
  const [extensionDate, setExtensionDate] = useState("2026-10-02");
  const [overstayReviewed, setOverstayReviewed] = useState(false);
  const [checkoutBalanceAcknowledged, setCheckoutBalanceAcknowledged] = useState(false);
  const [checkoutOutstandingReason, setCheckoutOutstandingReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [addedExtras, setAddedExtras] = useState<AddedExtra[]>(() =>
    (guest.selectedExtras ?? []).map((item) => ({
      id: item.id,
      quantity: item.quantity,
      nights: item.nights ?? 1,
      amount: getExtraCost(item.id, item.quantity, item.nights ?? 1),
      paymentChoice:
        guest.paymentStatus === "Paid" ? ("paid" as const) : ("later" as const),
    })),
  );
  const [extraId, setExtraId] = useState<string>(extras[0].id);
  const [extraQuantity, setExtraQuantity] = useState(1);
  const [extraNights, setExtraNights] = useState(1);
  const balance = Math.max(0, billTotal - amountPaid);
  const refundDue = Math.max(0, amountPaid - billTotal);
  const pendingBill = total - billTotal;
  const hasPendingBillChanges =
    pendingBill !== 0 ||
    addedExtras.some((item) => item.paymentChoice === "pending") ||
    roomAdjustments.some((item) => item.paymentChoice === "pending") ||
    assignedRooms.some((room) => room.bed?.paymentChoice === "pending");
  const paymentStatus =
    balance === 0 ? "Paid" : amountPaid === 0 ? "Unpaid" : "Partial";
  const activeRoom =
    assignedRooms.find((room) => room.key === activeRoomKey) ??
    assignedRooms[0]!;
  const roomRate =
    roomTypes.find((type) => type.name === activeRoom.name)?.rate ?? 850000;
  const bedRate = extraBedRates[activeRoom.name] ?? 150000;
  const bedTotal = assignedRooms.reduce(
    (sum, room) => sum + (room.bed?.amount ?? 0),
    0,
  );
  const isOverdue = stayState === "Overdue";
  const isDueOut = stayState === "Due Out";
  const isInHouse = stayState === "In House";
  const isCheckedOut = stayState === "Checked Out";
  const chosenExtra = experienceOptions.find((item) => item.id === extraId);
  const extraQuantityLimit = extraId === "breakfast" ? guest.adults : 1;
  const extraPreview = chosenExtra
    ? getExtraCost(
        extraId,
        extraQuantity,
        chosenExtra.perNight ? extraNights : 1,
      )
    : 0;
  const availableRooms = roomTypes.flatMap((type) =>
    type.numbers
      .filter(
        (number) =>
          number !== activeRoom.number &&
          !assignedRooms.some((room) => room.number === number) &&
          (activeRoom.adults <= 2 || type.id === "family"),
      )
      .map((number) => ({ number, type: type.name, rate: type.rate })),
  );
  const selectedRoom = availableRooms.find(
    (option) => option.number === selectedRoomNumber,
  );
  const roomDifference = selectedRoom
    ? (selectedRoom.rate - roomRate) * roomChangeNights +
      (activeRoom.bed
        ? ((extraBedRates[selectedRoom.type] ?? 150000) - bedRate) *
          activeRoom.bed.nights
        : 0)
    : 0;

  useEffect(() => {
    if (!modal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setModal(null);
    }
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [modal]);

  function openPayment() {
    setPaymentInput(String(balance));
    setError("");
    setModal("payment");
  }
  function openExtend() {
    setExtensionDate("2026-10-02");
    setError("");
    setModal("extend");
  }
  function openCheckout() {
    setOverstayReviewed(false);
    setCheckoutBalanceAcknowledged(false);
    setCheckoutOutstandingReason("");
    setError("");
    setModal("checkout");
  }
  function openExtra() {
    setExtraId(
      experienceOptions.find(
        (item) => !addedExtras.some((added) => added.id === item.id),
      )?.id ?? experienceOptions[0].id,
    );
    setExtraQuantity(1);
    setExtraNights(isInHouse ? 2 : 1);
    setError("");
    setModal("extra");
  }
  function openRoom(key: string) {
    const room = assignedRooms.find((item) => item.key === key);
    if (!room) return;
    setActiveRoomKey(key);
    const firstOption = roomTypes
      .flatMap((type) =>
        type.numbers.filter(
          (number) =>
            number !== room.number &&
            !assignedRooms.some((assigned) => assigned.number === number) &&
            (room.adults <= 2 || type.id === "family"),
        ),
      )
      .at(0);
    setSelectedRoomNumber(firstOption ?? "");
    setRoomChangeNights(isInHouse ? 2 : 1);
    setError("");
    setModal("room");
  }
  function openBed(key: string) {
    const room = assignedRooms.find((item) => item.key === key);
    if (!room) return;
    setActiveRoomKey(key);
    setBedEnabled(true);
    setBedNights(room.bed?.nights ?? (isInHouse ? 2 : 1));
    setError("");
    setModal("bed");
  }

  function changeRoom() {
    if (
      !selectedRoom ||
      !Number.isInteger(roomChangeNights) ||
      roomChangeNights < 1
    ) {
      setError(t("inHouseDetail.errors.roomInvalid"));
      return;
    }
    const roomPriceDifference =
      (selectedRoom.rate - roomRate) * roomChangeNights;
    const bedPriceDifference = activeRoom.bed
      ? ((extraBedRates[selectedRoom.type] ?? 150000) - bedRate) *
        activeRoom.bed.nights
      : 0;
    const difference = roomPriceDifference + bedPriceDifference;
    setRoomAdjustments((current) => [
      ...current,
      {
        id: `room-${current.length + 1}`,
        roomKey: activeRoomKey,
        from: `${activeRoom.name} ${activeRoom.number}`,
        to: `${selectedRoom.type} ${selectedRoom.number}`,
        amount: difference,
        bedDelta: bedPriceDifference,
        nights: roomChangeNights,
        paymentChoice:
          difference !== 0 ? ("pending" as const) : ("paid" as const),
      },
    ]);
    setTotal((current) => current + difference);
    setAssignedRooms((current) =>
      current.map((room) =>
        room.key === activeRoomKey
          ? {
              ...room,
              name: selectedRoom.type,
              number: selectedRoom.number,
              bed: room.bed
                ? {
                    ...room.bed,
                    amount:
                      (extraBedRates[selectedRoom.type] ?? 150000) *
                      room.bed.nights,
                  }
                : undefined,
            }
          : room,
      ),
    );
    setNotice(
      difference > 0
        ? t("inHouseDetail.notice.roomChangedCharge", { amount: formatRupiah(difference) })
        : difference < 0
          ? t("inHouseDetail.notice.roomChangedCredit", { amount: formatRupiah(-difference) })
          : t("inHouseDetail.notice.roomChangedNoDiff"),
    );
    setModal(null);
  }

  function manageBed() {
    const existing = activeRoom.bed;
    if (bedEnabled && (!Number.isInteger(bedNights) || bedNights < 1)) {
      setError(t("inHouseDetail.errors.bedNightsMin"));
      return;
    }
    const amount = bedEnabled ? bedRate * bedNights : 0;
    const difference = amount - (existing?.amount ?? 0);
    const chargeAmount =
      difference > 0 && existing?.paymentChoice === "paid"
        ? difference
        : amount;
    setAssignedRooms((current) =>
      current.map((room) =>
        room.key === activeRoomKey
          ? {
              ...room,
              bed: bedEnabled
                ? {
                    nights: bedNights,
                    amount,
                    chargeAmount:
                      difference > 0
                        ? chargeAmount
                        : (existing?.chargeAmount ?? 0),
                    paymentChoice:
                      difference > 0
                        ? ("pending" as const)
                        : (existing?.paymentChoice ?? ("paid" as const)),
                  }
                : undefined,
            }
          : room,
      ),
    );
    setTotal((current) => current + difference);
    setNotice(
      bedEnabled
        ? difference > 0
          ? t("inHouseDetail.notice.bedUpdatedAdd", { amount: formatRupiah(Math.abs(difference)) })
          : difference < 0
            ? t("inHouseDetail.notice.bedUpdatedReduce", { amount: formatRupiah(Math.abs(difference)) })
            : t("inHouseDetail.notice.bedUpdatedSame", { amount: formatRupiah(Math.abs(difference)) })
        : t("inHouseDetail.notice.bedRemoved"),
    );
    setModal(null);
  }

  function addExtra() {
    if (!chosenExtra || addedExtras.some((item) => item.id === extraId)) {
      setError(t("inHouseDetail.errors.extraNotAdded"));
      return;
    }
    if (
      !Number.isInteger(extraQuantity) ||
      extraQuantity < 1 ||
      extraQuantity > extraQuantityLimit ||
      !Number.isInteger(extraNights) ||
      extraNights < 1
    ) {
      setError(t("inHouseDetail.errors.extraInvalid"));
      return;
    }
    const nights = chosenExtra.perNight ? extraNights : 1;
    const amount = getExtraCost(extraId, extraQuantity, nights);
    setAddedExtras((current) => [
      ...current,
      {
        id: extraId,
        quantity: extraQuantity,
        nights,
        amount,
        paymentChoice: "pending",
      },
    ]);
    setTotal((current) => current + amount);
    setNotice(
      t("inHouseDetail.notice.extraAdded", { label: chosenExtra.label }),
    );
    setModal(null);
  }

  function removeExtra(id: string) {
    const selected = addedExtras.find((item) => item.id === id);
    if (!selected) return;
    if (
      selected.paymentChoice === "paid" ||
      total - selected.amount < amountPaid
    )
      return;
    setAddedExtras((current) => current.filter((item) => item.id !== id));
    setTotal((current) => current - selected.amount);
    setNotice(
      t("inHouseDetail.notice.extraRemoved", { label: extras.find((item) => item.id === id)?.label ?? t("inHouseDetail.addItem") }),
    );
  }

  function recordPayment() {
    const amount = Number(paymentInput);
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) {
      setError(
        t("inHouseDetail.errors.paymentInvalid"),
      );
      return;
    }
    setAmountPaid((current) => current + amount);
    if (amount === balance) {
      setAddedExtras((current) =>
        current.map((item) =>
          item.paymentChoice === "later"
            ? { ...item, paymentChoice: "paid" as const }
            : item,
        ),
      );
      setRoomAdjustments((current) =>
        current.map((item) =>
          item.paymentChoice === "later"
            ? { ...item, paymentChoice: "paid" as const }
            : item,
        ),
      );
      setAssignedRooms((current) =>
        current.map((room) =>
          room.bed?.paymentChoice === "later"
            ? { ...room, bed: { ...room.bed, paymentChoice: "paid" as const } }
            : room,
        ),
      );
    }
    setNotice(t("inHouseDetail.notice.paymentRecorded", { amount: formatRupiah(amount) }));
    setModal(null);
  }

  function saveBill() {
    setBillTotal(total);
    setAddedExtras((current) =>
      current.map((item) =>
        item.paymentChoice === "pending"
          ? { ...item, paymentChoice: "later" as const }
          : item,
      ),
    );
    setRoomAdjustments((current) =>
      current.map((item) =>
        item.paymentChoice === "pending"
          ? { ...item, paymentChoice: "later" as const }
          : item,
      ),
    );
    setAssignedRooms((current) =>
      current.map((room) =>
        room.bed?.paymentChoice === "pending"
          ? { ...room, bed: { ...room.bed, paymentChoice: "later" as const } }
          : room,
      ),
    );
    setNotice(t("inHouseDetail.notice.billSaved"));
  }

  function extendStay() {
    const nights = calculateNights(checkOut, extensionDate);
    if (nights < 1 || extensionDate <= "2026-09-30") {
      setError(t("inHouseDetail.errors.extendDate"));
      return;
    }
    const addedCost = assignedRooms.reduce(
      (sum, room) =>
        sum +
        (roomTypes.find((type) => type.name === room.name)?.rate ?? 850000) *
          nights,
      0,
    );
    setTotal((current) => current + addedCost);
    setCheckOut(extensionDate);
    setStayState("In House");
    setNotice(
      t("inHouseDetail.notice.stayExtended", { nights, amount: formatRupiah(addedCost) }),
    );
    setModal(null);
  }

  function concludeCheckout() {
    if (hasPendingBillChanges) {
      setError(t("inHouseDetail.errors.saveBillFirst"));
      return;
    }
    if (balance > 0 && (!checkoutBalanceAcknowledged || !checkoutOutstandingReason.trim())) {
      setError(t("inHouseDetail.errors.checkoutReasonRequired"));
      return;
    }
    if (isOverdue && !overstayReviewed) {
      setError(
        t("inHouseDetail.errors.overstayReview"),
      );
      return;
    }
    setStayState("Checked Out");
    setNotice(`${t("inHouseDetail.notice.checkoutDone")}${balance > 0 ? t("inHouseDetail.notice.checkoutBalance", { amount: formatRupiah(balance), reason: checkoutOutstandingReason.trim() }) : ""}${guest.deposit > 0 ? t("inHouseDetail.notice.checkoutDeposit", { amount: formatRupiah(guest.deposit) }) : ""}`);
    setModal(null);
  }

  return (
    <div className="guest-stay-page">
      <div className="guest-stay-breadcrumb">
        <Link href="/reservations/in-house">← {t("inHouseDetail.backInHouse")}</Link>
        <span>/</span>
        <span>{guest.bookingId}</span>
      </div>
      <div className="guest-stay-heading">
        <div>
          <div className="guest-stay-heading-line">
            <h1>{t("inHouseDetail.guestStay")}</h1>
            <span className="guest-stay-booking">{guest.bookingId}</span>
            <span className="reservations-source">{guest.source}</span>
            <span className="reservations-badge reservations-badge--success">
              {isCheckedOut ? t("inHouseDetail.checkedOut") : t("inHouseDetail.checkedIn")}
            </span>
            <span
              className={
                "reservations-badge reservations-badge--" +
                (paymentStatus === "Paid"
                  ? "success"
                  : paymentStatus === "Unpaid"
                    ? "danger"
                    : "warning")
              }
            >
              {paymentStatus}
            </span>
            <span
              className={
                "reservations-badge reservations-badge--" +
                (isOverdue
                  ? "danger"
                  : isDueOut
                    ? "warning"
                    : isCheckedOut
                      ? "neutral"
                      : "success")
              }
            >
              {isInHouse
                ? t("inHouseDetail.nightsRemaining")
                : isOverdue
                  ? t("inHouseDetail.overdueBadge")
                  : stayState}
            </span>
          </div>
          <p>
            {t("inHouseDetail.primaryGuest")}<strong>{guest.guestName}</strong>{t("inHouseDetail.scheduledCheckOut", { date: dateLabel(checkOut) })}
          </p>
        </div>
      
      </div>

      {notice && (
        <div
          className="reservation-feedback reservation-feedback--success"
          role="status"
        >
          {notice}
          <button
            type="button"
            aria-label={t("common.closeMessage")}
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      {isOverdue && (
        <div className="guest-stay-alert guest-stay-alert--danger">
          <div>
            <strong>{t("inHouseDetail.overdueTitle")}</strong>
            <p>
              {t("inHouseDetail.overdueBody", { date: dateLabel(checkOut) })}
            </p>
          </div>
          <div className="guest-stay-alert-actions">
            <button
              type="button"
              className="guest-stay-button guest-stay-button--secondary"
              onClick={openExtend}
            >
              {t("inHouseDetail.extendStay")}
            </button>
            {!hasPendingBillChanges && (
              <button
                type="button"
                className="guest-stay-button guest-stay-button--danger"
                onClick={openCheckout}
              >
                {t("inHouseDetail.checkOutGuest")}
              </button>
            )}
          </div>
        </div>
      )}
      {(isDueOut || isOverdue) && balance > 0 && (
        <div className="guest-stay-alert guest-stay-alert--warning">
          <div>
            <strong>{t("inHouseDetail.outstandingTitle")}</strong>
            <p>
              {t("inHouseDetail.outstandingBody", { amount: formatRupiah(balance) })}
            </p>
          </div>
        </div>
      )}

      <div className="guest-stay-columns">
        <div className="guest-stay-main">
          <Section title={t("inHouseDetail.guestStayInfo")}>
            <div className="guest-stay-info-grid">
              <Info label={t("inHouseDetail.guestName")} value={guest.guestName} />
              <Info label={t("inHouseDetail.whatsappPhone")} value={guest.whatsapp} />
              <Info label={t("inHouseDetail.bookingSource")} value={guest.source} />
              <Info
                label={t("inHouseDetail.roomNumbers")}
                value={assignedRooms.map((room) => room.number).join(", ")}
              />
              <Info
                label={t("inHouseDetail.checkIn")}
                value={t("inHouseDetail.checkInValue", { date: dateLabel(guest.checkIn) })}
              />
              <Info
                label={t("inHouseDetail.scheduledCheckOutLabel")}
                value={t("inHouseDetail.checkOutValue", { date: dateLabel(checkOut) })}
              />
              <Info
                label={t("inHouseDetail.duration")}
                value={t("inHouseDetail.nights", { count: calculateNights(guest.checkIn, checkOut) })}
              />
              <Info label={t("inHouseDetail.guests")} value={t("inHouseDetail.adults", { count: guest.adults })} />
            </div>
          </Section>
          <Section
            title={t("inHouseDetail.assignedRoomConfig")}
            aside={
              <span className="reservations-badge reservations-badge--success">
                {assignedRooms.length === 1
                  ? t("inHouseDetail.roomsOccupiedSingle")
                  : t("inHouseDetail.roomsOccupied", { count: assignedRooms.length })}
              </span>
            }
          >
            <div className="guest-stay-table-scroll">
              <table className="guest-stay-table guest-stay-room-table">
                <thead>
                  <tr>
                    <th>{t("inHouseDetail.tableRoomType")}</th>
                    <th>{t("inHouseDetail.tableRoomNo")}</th>
                    <th>{t("inHouseDetail.tableGuests")}</th>
                    <th>{t("inHouseDetail.tableDates")}</th>
                    <th>{t("inHouseDetail.tableExtraBed")}</th>
                    <th>{t("inHouseDetail.tableStatus")}</th>
                    <th>{t("inHouseDetail.tableActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedRooms.map((room) => (
                    <Fragment key={room.key}>
                      <tr>
                        <td>
                          <strong>{room.name}</strong>
                        </td>
                        <td>
                          <strong>{room.number}</strong>
                        </td>
                        <td>{t("inHouseDetail.adults", { count: room.adults })}</td>
                        <td>
                          {t("inHouseDetail.dateRange", { from: dateLabel(guest.checkIn), to: dateLabel(checkOut) })}
                        </td>
                        <td>
                          {room.bed ? (
                            <span className="guest-stay-bed-cell">
                              {t("inHouseDetail.bedCell", { amount: formatRupiah(room.bed.amount) })}
                            </span>
                          ) : (
                            <span className="in-house-muted">{t("common.emptyDash")}</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={
                              "reservations-badge reservations-badge--" +
                              (isOverdue
                                ? "danger"
                                : isDueOut
                                  ? "warning"
                                  : "success")
                            }
                          >
                            {isOverdue
                              ? t("inHouseDetail.statusOverdue")
                              : isDueOut
                                ? t("inHouseDetail.statusDueOut")
                                : isCheckedOut
                                  ? t("inHouseDetail.statusVacated")
                                  : t("inHouseDetail.statusOccupied")}
                          </span>
                        </td>
                        <td>
                          {!isCheckedOut && (
                            <div className="guest-stay-room-actions">
                              <button
                                type="button"
                                className="guest-stay-button guest-stay-button--secondary"
                                onClick={() => openRoom(room.key)}
                              >
                                {t("inHouseDetail.changeRoom")}
                              </button>
                              <button
                                type="button"
                                className="guest-stay-button guest-stay-button--secondary"
                                onClick={() => openBed(room.key)}
                              >
                                {t("inHouseDetail.manageExtraBed")}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {room.bed && (
                        <tr className="guest-stay-bed-row">
                          <td colSpan={7}>
                            <span>↳</span>
                            <strong>{t("inHouseDetail.extraBedRowLabel", { room: room.number })}</strong>
                            <span>
                              {t("inHouseDetail.extraBedRowDetail", { from: dateLabel(guest.checkIn), to: dateLabel(checkOut), nights: room.bed.nights, rate: formatRupiah(extraBedRates[room.name] ?? 150000) })}
                              <strong>{formatRupiah(room.bed.amount)}</strong>
                            </span>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          <Section
            title={t("inHouseDetail.experiencesAddOns")}
            aside={
              !isCheckedOut && (
                <button
                  type="button"
                  className="guest-stay-button guest-stay-button--secondary"
                  onClick={openExtra}
                  disabled={addedExtras.length === experienceOptions.length}
                >
                  ＋ {t("inHouseDetail.addItem")}
                </button>
              )
            }
          >
            {addedExtras.length === 0 ? (
              <p className="guest-stay-empty">
                {t("inHouseDetail.experiencesEmpty")}
              </p>
            ) : (
              <div className="guest-stay-extras">
                {addedExtras.map((item) => {
                  const extra = extras.find((option) => option.id === item.id);
                  if (!extra) return null;
                  return (
                    <div className="guest-stay-extra" key={item.id}>
                      <div>
                        <strong>{extra.label}</strong>
                        <small>
                          {item.quantity} × {formatRupiah(extra.price)}
                          {extra.perNight
                            ? t("inHouseDetail.extraPerNight", { nights: item.nights })
                            : ""} ·{" "}
                          {item.paymentChoice === "pending"
                            ? t("inHouseDetail.extraUnsaved")
                            : item.paymentChoice === "paid" || balance === 0
                              ? t("inHouseDetail.extraPaid")
                              : t("inHouseDetail.extraPayLater")}
                        </small>
                      </div>
                      <strong>{formatRupiah(item.amount)}</strong>
                      {!isCheckedOut && (
                        <button
                          type="button"
                          onClick={() => removeExtra(item.id)}
                          disabled={
                            item.paymentChoice === "paid" ||
                            total - item.amount < amountPaid
                          }
                          title={
                            item.paymentChoice === "paid" ||
                            total - item.amount < amountPaid
                              ? t("inHouseDetail.extraPaid")
                              : t("inHouseDetail.extraRemoveTitle")
                          }
                          aria-label={t("ota.rooms.removeAriaLabel", { name: extra.label })}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
          <Section
            title={t("inHouseDetail.chargesPayments")}
            aside={<span>{t("inHouseDetail.currencyIdr")}</span>}
          >
            <div className="guest-stay-ledger">
              <div>
                <span>{t("inHouseDetail.roomExtensionCharges")}</span>
                <strong>
                  {formatRupiah(
                    total -
                      addedExtras.reduce((sum, item) => sum + item.amount, 0) -
                      bedTotal -
                      roomAdjustments.reduce(
                        (sum, item) => sum + item.amount - item.bedDelta,
                        0,
                      ),
                  )}
                </strong>
              </div>
              {roomAdjustments.map((item) => (
                <div key={item.id}>
                  <span>
                    {t("inHouseDetail.changeRoomLedger", { from: item.from, to: item.to, nights: item.nights })}
                  </span>
                  <strong>
                    {item.amount < 0 ? "−" : "+"}
                    {formatRupiah(Math.abs(item.amount))}
                  </strong>
                </div>
              ))}
              <div>
                <span>
                  {t("inHouseDetail.extraBedLedger", { rooms: assignedRooms
                    .filter((room) => room.bed)
                    .map((room) => room.number)
                    .join(", ") || t("common.emptyDash") })}
                </span>
                <strong>{formatRupiah(bedTotal)}</strong>
              </div>
              <div>
                <span>{t("inHouseDetail.experiencesAddOns")}</span>
                <strong>
                  {formatRupiah(
                    addedExtras.reduce((sum, item) => sum + item.amount, 0),
                  )}
                </strong>
              </div>
              <div>
                <span>{t("inHouseDetail.bookingTotal")}</span>
                <strong>{formatRupiah(total)}</strong>
              </div>
              {pendingBill !== 0 && (
                <div>
                  <span>{t("inHouseDetail.pendingBill")}</span>
                  <strong>{formatRupiah(pendingBill)}</strong>
                </div>
              )}
              <div>
                <span>{t("inHouseDetail.totalPaid")}</span>
                <strong>{formatRupiah(amountPaid)}</strong>
              </div>
              <div className="guest-stay-ledger-balance">
                <span>{t("inHouseDetail.remainingBalance")}</span>
                <strong>{formatRupiah(balance)}</strong>
              </div>
              {refundDue > 0 && (
                <div className="guest-stay-ledger-credit">
                  <span>{t("inHouseDetail.refundDue")}</span>
                  <strong>{formatRupiah(refundDue)}</strong>
                </div>
              )}
            </div>
            {pendingBill !== 0 && (
              <p className="guest-stay-charge-later">
                <span>{t("inHouseDetail.unsavedBillChange")}</span>
                <strong>{formatRupiah(pendingBill)}</strong>
              </p>
            )}
            {roomAdjustments
              .filter((item) => item.amount < 0)
              .map((item) => (
                <p className="guest-stay-charge-later" key={item.id}>
                  <span>
                    {t("inHouseDetail.roomChangeCredit", { from: item.from, to: item.to })}
                  </span>
                  <strong>{formatRupiah(-item.amount)}</strong>
                </p>
              ))}
            {balance > 0 &&
              roomAdjustments
                .filter(
                  (item) => item.amount > 0 && item.paymentChoice === "later",
                )
                .map((item) => (
                  <p className="guest-stay-charge-later" key={item.id}>
                    <span>{t("inHouseDetail.roomChangeDiff", { to: item.to })}</span>
                    <strong>{t("inHouseDetail.payLaterLine", { amount: formatRupiah(item.amount) })}</strong>
                  </p>
                ))}
            {balance > 0 &&
              assignedRooms
                .filter((room) => room.bed?.paymentChoice === "later")
                .map((room) => (
                  <p className="guest-stay-charge-later" key={room.key}>
                    <span>{t("inHouseDetail.extraBedRoomLine", { room: room.number })}</span>
                    <strong>
                      {t("inHouseDetail.payLaterLine", { amount: formatRupiah(room.bed!.chargeAmount) })}
                    </strong>
                  </p>
                ))}
            {balance > 0 &&
              addedExtras
                .filter((item) => item.paymentChoice === "later")
                .map((item) => (
                  <p className="guest-stay-charge-later" key={item.id}>
                    <span>
                      {extras.find((option) => option.id === item.id)?.label}
                    </span>
                    <strong>{t("inHouseDetail.payLaterLine", { amount: formatRupiah(item.amount) })}</strong>
                  </p>
                ))}
          </Section>
          <Section title={t("inHouseDetail.securityDeposit")}>
            <div className="guest-stay-deposit">
              <div>
                <strong>
                  {guest.deposit > 0
                    ? formatRupiah(guest.deposit)
                    : t("inHouseDetail.noDeposit")}
                </strong>
                <p>
                  {guest.deposit > 0
                    ? isCheckedOut
                      ? t("inHouseDetail.depositSettlement")
                      : t("inHouseDetail.depositHeldNote")
                    : t("inHouseDetail.depositNone")}
                </p>
              </div>
              <span
                className={
                  "reservations-badge reservations-badge--" +
                  (guest.deposit > 0 ? "info" : "neutral")
                }
              >
                {guest.deposit > 0 ? t("inHouseDetail.depositHeld") : t("inHouseDetail.depositNoneBadge")}
              </span>
            </div>
          </Section>
          <Section title={t("inHouseDetail.internalNotes")}>
            <p className="guest-stay-empty">
              {t("inHouseDetail.internalNotesEmpty")}
            </p>
          </Section>
        </div>
        <aside className="guest-stay-summary">
          <div className="guest-stay-summary-head">
            <h2>{t("inHouseDetail.staySummary")}</h2>
            <span
              className={
                "reservations-badge reservations-badge--" +
                (isOverdue ? "danger" : isDueOut ? "warning" : "success")
              }
            >
              {stayState}
            </span>
          </div>
          <div className="guest-stay-summary-block">
            <Info label={t("inHouseDetail.guest")} value={guest.guestName} />
            <Info
              label={t("inHouseDetail.assignedRooms")}
              value={t("inHouseDetail.assignedRoomsValue", { count: assignedRooms.length, numbers: assignedRooms.map((room) => room.number).join(", ") })}
            />
            <Info
              label={t("inHouseDetail.stay")}
              value={t("inHouseDetail.dateRange", { from: dateLabel(guest.checkIn), to: dateLabel(checkOut) })}
            />
            <Info label={t("inHouseDetail.bookingTotal")} value={formatRupiah(total)} />
            {pendingBill !== 0 && (
              <Info label={t("inHouseDetail.pendingBill")} value={formatRupiah(pendingBill)} />
            )}
            <Info label={t("inHouseDetail.totalPaid")} value={formatRupiah(amountPaid)} />
            <Info
              label={t("inHouseDetail.securityDeposit")}
              value={
                guest.deposit > 0 ? formatRupiah(guest.deposit) : t("inHouseDetail.noDeposit")
              }
            />
          </div>
          <div className="guest-stay-summary-balance">
            <span>{refundDue > 0 ? t("inHouseDetail.refundDue") : t("inHouseDetail.remainingBalance")}</span>
            <strong>{formatRupiah(refundDue > 0 ? refundDue : balance)}</strong>
          </div>
          <div className="guest-stay-summary-actions">
            {!isCheckedOut && (
              <>
                {balance > 0 && (
                  <button
                    type="button"
                    className="guest-stay-button guest-stay-button--primary"
                    onClick={openPayment}
                  >
                    {t("inHouseDetail.recordPayment")}
                  </button>
                )}
                <button
                  type="button"
                  className="guest-stay-button guest-stay-button--bill"
                  onClick={saveBill}
                  disabled={!hasPendingBillChanges}
                >
                  {t("inHouseDetail.saveBill")}
                </button>
                {(isDueOut || isOverdue) && (
                  <button
                    type="button"
                    className={
                      "guest-stay-button " +
                      (isOverdue
                        ? "guest-stay-button--danger"
                        : "guest-stay-button--primary")
                    }
                    onClick={openCheckout}
                    disabled={hasPendingBillChanges}
                  >
                    {t("inHouseDetail.checkOutGuest")}
                  </button>
                )}
                <button
                  type="button"
                  className="guest-stay-button guest-stay-button--outline"
                  onClick={openExtend}
                >
                  {t("inHouseDetail.extendStay")}
                </button>
              </>
            )}
            {isCheckedOut && (
              <p className="guest-stay-empty">
                {t("inHouseDetail.concludedDemo")}
              </p>
            )}
          </div>
          {balance > 0 && (
            <p className="guest-stay-summary-note">
              {t("inHouseDetail.checkoutBalanceNote")}
            </p>
          )}
          {hasPendingBillChanges && (
            <p className="guest-stay-summary-note">
              {t("inHouseDetail.saveBillBeforeCheckout")}
            </p>
          )}
          {refundDue > 0 && (
            <p className="guest-stay-summary-note">
              {t("inHouseDetail.refundManualNote")}
            </p>
          )}
        </aside>
      </div>

      {(modal === "payment" || modal === "extend" || modal === "checkout") && (
        <div
          className="guest-stay-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
        >
          <section
            className="guest-stay-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-stay-modal-title"
          >
            <div className="guest-stay-modal-head">
              <h2 id="guest-stay-modal-title">
                {modal === "payment"
                  ? t("inHouseDetail.modal.recordPaymentTitle")
                  : modal === "extend"
                    ? t("inHouseDetail.modal.extendStayTitle")
                    : t("inHouseDetail.modal.checkOutTitle")}
              </h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label={t("common.closeModal")}
              >
                ×
              </button>
            </div>
            <div className="guest-stay-modal-body">
              <p>
                <strong>{guest.guestName}</strong> · {guest.bookingId}
              </p>
              {modal === "payment" && (
                <>
                  <p>
                    {t("inHouseDetail.modal.remainingBalance")}<strong>{formatRupiah(balance)}</strong>
                  </p>
                  {balance > 0 && <div className="guest-stay-outstanding-checkout">
                    <p>{t("inHouseDetail.modal.outstandingNote")}</p>
                    <label className="guest-stay-modal-check">
                      <input type="checkbox" checked={checkoutBalanceAcknowledged} onChange={(event) => setCheckoutBalanceAcknowledged(event.target.checked)} />
                      <span>{t("inHouseDetail.modal.outstandingAcknowledge")}</span>
                    </label>
                    <label className="guest-stay-outstanding-reason">{t("inHouseDetail.modal.reason")} <span>*</span>
                      <textarea value={checkoutOutstandingReason} onChange={(event) => setCheckoutOutstandingReason(event.target.value)} placeholder={t("inHouseDetail.modal.reasonPlaceholder")} rows={3} />
                    </label>
                  </div>}
                  <label>
                    {t("inHouseDetail.modal.paymentAmount")}
                    <input
                      type="number"
                      min="1"
                      max={balance}
                      value={paymentInput}
                      onChange={(event) => setPaymentInput(event.target.value)}
                    />
                  </label>
                  <small>
                    {t("inHouseDetail.modal.paymentDemoNote")}
                  </small>
                </>
              )}
              {modal === "extend" && (
                <>
                  <p>
                    {t("inHouseDetail.modal.currentCheckOut")}<strong>{dateLabel(checkOut)}</strong>
                  </p>
                  <label>
                    {t("inHouseDetail.modal.newCheckOutDate")}
                    <input
                      type="date"
                      value={extensionDate}
                      onChange={(event) => setExtensionDate(event.target.value)}
                    />
                  </label>
                  <small>
                    {t("inHouseDetail.modal.extendRateNote", { rate: formatRupiah(roomRate) })}
                  </small>
                </>
              )}
              {modal === "checkout" && (
                <>
                  <p>
                    {t("inHouseDetail.modal.remainingBalance")}<strong>{formatRupiah(balance)}</strong>
                  </p>
                  <p>
                    {t("inHouseDetail.modal.securityDeposit")}
                    <strong>
                      {guest.deposit > 0
                        ? formatRupiah(guest.deposit)
                        : t("inHouseDetail.noDeposit")}
                    </strong>
                  </p>
                  {guest.deposit > 0 && (
                    <p>
                      {t("inHouseDetail.modal.depositRefundNote")}
                    </p>
                  )}
                  {isOverdue && (
                    <label className="guest-stay-modal-check">
                      <input
                        type="checkbox"
                        checked={overstayReviewed}
                        onChange={(event) =>
                          setOverstayReviewed(event.target.checked)
                        }
                      />
                      <span>
                        {t("inHouseDetail.modal.overstayReviewed")}
                      </span>
                    </label>
                  )}
                </>
              )}
              {error && (
                <p className="guest-stay-modal-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="guest-stay-modal-actions">
              <button
                type="button"
                className="guest-stay-button guest-stay-button--secondary"
                onClick={() => setModal(null)}
              >
                {t("inHouseDetail.modal.cancel")}
              </button>
              <button
                type="button"
                className="guest-stay-button guest-stay-button--primary"
                disabled={modal === "checkout" && balance > 0 && (!checkoutBalanceAcknowledged || !checkoutOutstandingReason.trim())}
                onClick={
                  modal === "payment"
                    ? recordPayment
                    : modal === "extend"
                      ? extendStay
                      : concludeCheckout
                }
              >
                {modal === "payment"
                  ? t("inHouseDetail.modal.savePayment")
                  : modal === "extend"
                    ? t("inHouseDetail.modal.confirmExtension")
                    : t("inHouseDetail.modal.confirmCheckout")}
              </button>
            </div>
          </section>
        </div>
      )}
      {modal === "extra" && (
        <div
          className="guest-stay-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
        >
          <section
            className="guest-stay-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-stay-extra-title"
          >
            <div className="guest-stay-modal-head">
              <h2 id="guest-stay-extra-title">{t("inHouseDetail.modal.addItemTitle")}</h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label={t("common.closeModal")}
              >
                ×
              </button>
            </div>
            <div className="guest-stay-modal-body">
              <label>
                {t("inHouseDetail.modal.item")}
                <select
                  value={extraId}
                  onChange={(event) => {
                    setExtraId(event.target.value);
                    setExtraQuantity(1);
                    setError("");
                  }}
                >
                  {experienceOptions
                    .filter(
                      (item) =>
                        !addedExtras.some((added) => added.id === item.id),
                    )
                    .map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.label}
                      </option>
                    ))}
                </select>
              </label>
              <p>
                {t("inHouseDetail.modal.unitPrice")}
                <strong>
                  {chosenExtra
                    ? `${formatRupiah(chosenExtra.price)} ${chosenExtra.unit}`
                    : t("common.emptyDash")}
                </strong>
              </p>
              <label>
                {t("inHouseDetail.modal.quantity")}
                <input
                  type="number"
                  min="1"
                  max={extraQuantityLimit}
                  value={extraQuantity}
                  onChange={(event) =>
                    setExtraQuantity(Number(event.target.value))
                  }
                />
              </label>
              {chosenExtra?.perNight && (
                <label>
                  {t("inHouseDetail.modal.nightsCount")}
                  <input
                    type="number"
                    min="1"
                    value={extraNights}
                    onChange={(event) =>
                      setExtraNights(Number(event.target.value))
                    }
                  />
                </label>
              )}
              <div className="guest-stay-extra-preview">
                <span>{t("inHouseDetail.modal.addToBill")}</span>
                <strong>{formatRupiah(extraPreview)}</strong>
              </div>
              {error && (
                <p className="guest-stay-modal-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="guest-stay-modal-actions">
              <button
                type="button"
                className="guest-stay-button guest-stay-button--secondary"
                onClick={() => setModal(null)}
              >
                {t("inHouseDetail.modal.cancel")}
              </button>
              <button
                type="button"
                className="guest-stay-button guest-stay-button--primary"
                onClick={addExtra}
              >
                {t("inHouseDetail.modal.addItem")}
              </button>
            </div>
          </section>
        </div>
      )}
      {modal === "room" && (
        <div
          className="guest-stay-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
        >
          <section
            className="guest-stay-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-stay-room-title"
          >
            <div className="guest-stay-modal-head">
              <h2 id="guest-stay-room-title">{t("inHouseDetail.modal.changeRoomTitle")}</h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label={t("common.closeModal")}
              >
                ×
              </button>
            </div>
            <div className="guest-stay-modal-body">
              <p>
                {t("inHouseDetail.modal.currentRoom")}
                <strong>
                  {t("inHouseDetail.modal.currentRoomValue", { roomType: activeRoom.name, roomNumber: activeRoom.number })}
                </strong>
                {t("inHouseDetail.modal.currentRoomRate", { rate: formatRupiah(roomRate) })}
              </p>
              <p>
                {t("inHouseDetail.modal.roomChoicesForPeriod", { from: dateLabel(guest.checkIn), to: dateLabel(checkOut) })}
              </p>
              <label>
                {t("inHouseDetail.modal.newRoom")}
                <select
                  value={selectedRoomNumber}
                  onChange={(event) => {
                    setSelectedRoomNumber(event.target.value);
                    setError("");
                  }}
                >
                  {availableRooms.map((option) => (
                    <option key={option.number} value={option.number}>
                      {t("inHouseDetail.modal.roomOption", { roomType: option.type, roomNumber: option.number, rate: formatRupiah(option.rate) })}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("inHouseDetail.modal.adjustedNights")}
                <input
                  type="number"
                  min="1"
                  value={roomChangeNights}
                  onChange={(event) =>
                    setRoomChangeNights(Number(event.target.value))
                  }
                />
              </label>
              {activeRoom.bed && (
                <small>
                  {t("inHouseDetail.modal.extraBedAdjustNote", { rate: formatRupiah(extraBedRates[selectedRoom?.type ?? activeRoom.name] ?? 150000) })}
                </small>
              )}
              <div className="guest-stay-extra-preview">
                <span>
                  {roomDifference < 0
                    ? t("inHouseDetail.modal.creditDowngrade")
                    : roomDifference > 0
                      ? t("inHouseDetail.modal.upgradeAddition")
                      : t("inHouseDetail.modal.priceDifference")}
                </span>
                <strong>
                  {roomDifference < 0 ? "−" : roomDifference > 0 ? "+" : ""}
                  {formatRupiah(Math.abs(roomDifference))}
                </strong>
              </div>
              {roomDifference < 0 && (
                <small>
                  {t("inHouseDetail.modal.refundIfExceeds")}
                </small>
              )}
              {error && (
                <p className="guest-stay-modal-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="guest-stay-modal-actions">
              <button
                type="button"
                className="guest-stay-button guest-stay-button--secondary"
                onClick={() => setModal(null)}
              >
                {t("inHouseDetail.modal.cancel")}
              </button>
              <button
                type="button"
                className="guest-stay-button guest-stay-button--primary"
                onClick={changeRoom}
                disabled={!selectedRoom}
              >
                {t("inHouseDetail.modal.confirmChange")}
              </button>
            </div>
          </section>
        </div>
      )}
      {modal === "bed" && (
        <div
          className="guest-stay-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
        >
          <section
            className="guest-stay-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-stay-bed-title"
          >
            <div className="guest-stay-modal-head">
              <h2 id="guest-stay-bed-title">{t("inHouseDetail.modal.manageBedTitle")}</h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label={t("common.closeModal")}
              >
                ×
              </button>
            </div>
            <div className="guest-stay-modal-body">
              <p>
                {t("inHouseDetail.modal.bedMaxNote", { roomType: activeRoom.name, roomNumber: activeRoom.number })}
              </p>
              <label>
                {t("inHouseDetail.modal.extraBed")}
                <select
                  value={bedEnabled ? "1" : "0"}
                  onChange={(event) =>
                    setBedEnabled(event.target.value === "1")
                  }
                >
                  <option value="1">{t("inHouseDetail.modal.oneExtraBed")}</option>
                  <option value="0">{t("inHouseDetail.modal.noExtraBed")}</option>
                </select>
              </label>
              {bedEnabled && (
                <label>
                  {t("inHouseDetail.modal.nightsCount")}
                  <input
                    type="number"
                    min="1"
                    value={bedNights}
                    onChange={(event) =>
                      setBedNights(Number(event.target.value))
                    }
                  />
                </label>
              )}
              <p>
                {t("inHouseDetail.modal.bedRateNote", { roomType: activeRoom.name })}
                <strong>{t("inHouseDetail.modal.bedRateValue", { rate: formatRupiah(bedRate) })}</strong>
              </p>
              <div className="guest-stay-extra-preview">
                <span>{t("inHouseDetail.modal.billChange")}</span>
                <strong>
                  {formatRupiah(
                    (bedEnabled ? bedRate * bedNights : 0) -
                      (activeRoom.bed?.amount ?? 0),
                  )}
                </strong>
              </div>
              {error && (
                <p className="guest-stay-modal-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="guest-stay-modal-actions">
              <button
                type="button"
                className="guest-stay-button guest-stay-button--secondary"
                onClick={() => setModal(null)}
              >
                {t("inHouseDetail.modal.cancel")}
              </button>
              <button
                type="button"
                className="guest-stay-button guest-stay-button--primary"
                onClick={manageBed}
              >
                {t("inHouseDetail.modal.saveExtraBed")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

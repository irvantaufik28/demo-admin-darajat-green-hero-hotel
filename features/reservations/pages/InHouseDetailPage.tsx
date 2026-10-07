"use client";
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
  const { bookingId } = useParams<{ bookingId: string }>();
  const guest = inHouseGuests.find((item) => item.bookingId === bookingId);

  return (
    <AdminShell title="Reservations" context="In House">
      {guest ? (
        <GuestStay key={guest.bookingId} guest={guest} />
      ) : (
        <div className="guest-stay-page">
          <h1>Reservasi tidak ditemukan</h1>
          <Link href="/reservations/in-house">← In House</Link>
        </div>
      )}
    </AdminShell>
  );
}

function GuestStay({ guest }: { guest: InHouseRecord }) {
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
      setError("Pilih kamar tersedia dan jumlah malam yang valid.");
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
        ? `Kamar diubah. Simpan tagihan ${formatRupiah(difference)} di Summary.`
        : difference < 0
          ? `Kamar diubah. Simpan kredit ${formatRupiah(-difference)} di Summary.`
          : "Nomor kamar berhasil diubah tanpa selisih tarif.",
    );
    setModal(null);
  }

  function manageBed() {
    const existing = activeRoom.bed;
    if (bedEnabled && (!Number.isInteger(bedNights) || bedNights < 1)) {
      setError("Jumlah malam harus minimal 1.");
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
        ? `Extra Bed diperbarui. ${difference > 0 ? "Tambahan biaya" : difference < 0 ? "Pengurangan biaya" : "Biaya"} ${formatRupiah(Math.abs(difference))} tercatat.`
        : "Extra Bed dihapus dari tagihan.",
    );
    setModal(null);
  }

  function addExtra() {
    if (!chosenExtra || addedExtras.some((item) => item.id === extraId)) {
      setError("Pilih item yang belum ditambahkan.");
      return;
    }
    if (
      !Number.isInteger(extraQuantity) ||
      extraQuantity < 1 ||
      extraQuantity > extraQuantityLimit ||
      !Number.isInteger(extraNights) ||
      extraNights < 1
    ) {
      setError("Periksa jumlah item dan malam yang dipilih.");
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
      `${chosenExtra.label} ditambahkan. Tekan Save Bill di Summary untuk menagihnya nanti.`,
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
      `${extras.find((item) => item.id === id)?.label ?? "Add-on"} dihapus dari tagihan.`,
    );
  }

  function recordPayment() {
    const amount = Number(paymentInput);
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) {
      setError(
        "Jumlah pembayaran harus lebih dari Rp0 dan tidak melebihi sisa tagihan.",
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
    setNotice(`Pembayaran ${formatRupiah(amount)} dicatat untuk demo ini.`);
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
    setNotice("Tagihan disimpan. Biaya baru masuk ke Remaining Balance untuk dibayar nanti.");
  }

  function extendStay() {
    const nights = calculateNights(checkOut, extensionDate);
    if (nights < 1 || extensionDate <= "2026-09-30") {
      setError("Pilih tanggal check-out baru setelah 30 Sep 2026.");
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
      `Masa menginap diperpanjang ${nights} malam. Tekan Save Bill untuk menyimpan tambahan biaya ${formatRupiah(addedCost)}.`,
    );
    setModal(null);
  }

  function concludeCheckout() {
    if (hasPendingBillChanges) {
      setError("Simpan perubahan tagihan sebelum check-out.");
      return;
    }
    if (balance > 0 && (!checkoutBalanceAcknowledged || !checkoutOutstandingReason.trim())) {
      setError("Centang konfirmasi dan isi alasan check-out dengan sisa tagihan.");
      return;
    }
    if (isOverdue && !overstayReviewed) {
      setError(
        "Tinjau potensi biaya lewat waktu bersama supervisor sebelum check-out.",
      );
      return;
    }
    setStayState("Checked Out");
    setNotice(`Check-out selesai.${balance > 0 ? ` Sisa tagihan ${formatRupiah(balance)}. Alasan: ${checkoutOutstandingReason.trim()}.` : ""}${guest.deposit > 0 ? ` Deposit ${formatRupiah(guest.deposit)} perlu diselesaikan.` : ""}`);
    setModal(null);
  }

  return (
    <div className="guest-stay-page">
      <div className="guest-stay-breadcrumb">
        <Link href="/reservations/in-house">← In House</Link>
        <span>/</span>
        <span>{guest.bookingId}</span>
      </div>
      <div className="guest-stay-heading">
        <div>
          <div className="guest-stay-heading-line">
            <h1>Guest Stay</h1>
            <span className="guest-stay-booking">{guest.bookingId}</span>
            <span className="reservations-source">{guest.source}</span>
            <span className="reservations-badge reservations-badge--success">
              {isCheckedOut ? "Checked-out" : "Checked-in"}
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
                ? "2 Nights Remaining"
                : isOverdue
                  ? "Overdue · 1 Day"
                  : stayState}
            </span>
          </div>
          <p>
            Primary Guest: <strong>{guest.guestName}</strong> · Scheduled
            check-out {dateLabel(checkOut)}
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
            aria-label="Tutup pesan"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      {isOverdue && (
        <div className="guest-stay-alert guest-stay-alert--danger">
          <div>
            <strong>Lewat jadwal check-out · 1 hari</strong>
            <p>
              Check-out dijadwalkan {dateLabel(checkOut)} pukul 12.00. Periksa
              potensi biaya tambahan satu malam sebelum memperpanjang masa inap
              atau menyelesaikan check-out.
            </p>
          </div>
          <div className="guest-stay-alert-actions">
            <button
              type="button"
              className="guest-stay-button guest-stay-button--secondary"
              onClick={openExtend}
            >
              Extend Stay
            </button>
            {!hasPendingBillChanges && (
              <button
                type="button"
                className="guest-stay-button guest-stay-button--danger"
                onClick={openCheckout}
              >
                Check Out Guest
              </button>
            )}
          </div>
        </div>
      )}
      {(isDueOut || isOverdue) && balance > 0 && (
        <div className="guest-stay-alert guest-stay-alert--warning">
          <div>
            <strong>Outstanding payment</strong>
            <p>
              Sisa tagihan {formatRupiah(balance)} dapat ditindaklanjuti setelah
              check-out dengan konfirmasi dan alasan petugas.
            </p>
          </div>
        </div>
      )}

      <div className="guest-stay-columns">
        <div className="guest-stay-main">
          <Section title="Guest & Stay Information">
            <div className="guest-stay-info-grid">
              <Info label="Guest Name" value={guest.guestName} />
              <Info label="WhatsApp / Phone" value={guest.whatsapp} />
              <Info label="Booking Source" value={guest.source} />
              <Info
                label="Room Numbers"
                value={assignedRooms.map((room) => room.number).join(", ")}
              />
              <Info
                label="Check-in"
                value={`${dateLabel(guest.checkIn)} · 14:00`}
              />
              <Info
                label="Scheduled Check-out"
                value={`${dateLabel(checkOut)} · 12:00`}
              />
              <Info
                label="Duration"
                value={`${calculateNights(guest.checkIn, checkOut)} Nights`}
              />
              <Info label="Guests" value={`${guest.adults} Adults`} />
            </div>
          </Section>
          <Section
            title="Assigned Room & Configuration"
            aside={
              <span className="reservations-badge reservations-badge--success">
                {assignedRooms.length}{" "}
                {assignedRooms.length === 1 ? "Room" : "Rooms"} Occupied
              </span>
            }
          >
            <div className="guest-stay-table-scroll">
              <table className="guest-stay-table guest-stay-room-table">
                <thead>
                  <tr>
                    <th>ROOM TYPE</th>
                    <th>ROOM NO.</th>
                    <th>GUESTS</th>
                    <th>DATES</th>
                    <th>EXTRA BED</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
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
                        <td>{room.adults} Adults</td>
                        <td>
                          {dateLabel(guest.checkIn)} – {dateLabel(checkOut)}
                        </td>
                        <td>
                          {room.bed ? (
                            <span className="guest-stay-bed-cell">
                              1 Bed ({formatRupiah(room.bed.amount)})
                            </span>
                          ) : (
                            <span className="in-house-muted">—</span>
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
                              ? "Overdue 1d"
                              : isDueOut
                                ? "Due Out Today"
                                : isCheckedOut
                                  ? "Vacated"
                                  : "Occupied"}
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
                                Change Room
                              </button>
                              <button
                                type="button"
                                className="guest-stay-button guest-stay-button--secondary"
                                onClick={() => openBed(room.key)}
                              >
                                Manage Extra Bed
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {room.bed && (
                        <tr className="guest-stay-bed-row">
                          <td colSpan={7}>
                            <span>↳</span>
                            <strong>Extra Bed (Room {room.number})</strong>
                            <span>
                              1 Bed · {dateLabel(guest.checkIn)} –{" "}
                              {dateLabel(checkOut)} ({room.bed.nights} Nights @{" "}
                              {formatRupiah(extraBedRates[room.name] ?? 150000)}
                              ) ={" "}
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
            title="Experiences & Add-ons"
            aside={
              !isCheckedOut && (
                <button
                  type="button"
                  className="guest-stay-button guest-stay-button--secondary"
                  onClick={openExtra}
                  disabled={addedExtras.length === experienceOptions.length}
                >
                  ＋ Add Item
                </button>
              )
            }
          >
            {addedExtras.length === 0 ? (
              <p className="guest-stay-empty">
                Belum ada experience atau add-on.
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
                            ? ` × ${item.nights} malam`
                            : ""} ·{" "}
                          {item.paymentChoice === "pending"
                            ? "Belum disimpan"
                            : item.paymentChoice === "paid" || balance === 0
                              ? "Dibayar"
                              : "Bayar nanti"}
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
                              ? "Pembayaran sudah mencakup item ini"
                              : "Hapus item"
                          }
                          aria-label={`Hapus ${extra.label}`}
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
            title="Charges & Payments"
            aside={<span>Currency: IDR</span>}
          >
            <div className="guest-stay-ledger">
              <div>
                <span>Room & Extension Charges</span>
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
                    Change Room · {item.from} → {item.to} ({item.nights} malam)
                  </span>
                  <strong>
                    {item.amount < 0 ? "−" : "+"}
                    {formatRupiah(Math.abs(item.amount))}
                  </strong>
                </div>
              ))}
              <div>
                <span>
                  Extra Bed (
                  {assignedRooms
                    .filter((room) => room.bed)
                    .map((room) => room.number)
                    .join(", ") || "—"}
                  )
                </span>
                <strong>{formatRupiah(bedTotal)}</strong>
              </div>
              <div>
                <span>Experiences & Add-ons</span>
                <strong>
                  {formatRupiah(
                    addedExtras.reduce((sum, item) => sum + item.amount, 0),
                  )}
                </strong>
              </div>
              <div>
                <span>Booking Total</span>
                <strong>{formatRupiah(total)}</strong>
              </div>
              {pendingBill !== 0 && (
                <div>
                  <span>Pending Bill</span>
                  <strong>{formatRupiah(pendingBill)}</strong>
                </div>
              )}
              <div>
                <span>Total Paid</span>
                <strong>{formatRupiah(amountPaid)}</strong>
              </div>
              <div className="guest-stay-ledger-balance">
                <span>Remaining Balance</span>
                <strong>{formatRupiah(balance)}</strong>
              </div>
              {refundDue > 0 && (
                <div className="guest-stay-ledger-credit">
                  <span>Refund Due</span>
                  <strong>{formatRupiah(refundDue)}</strong>
                </div>
              )}
            </div>
            {pendingBill !== 0 && (
              <p className="guest-stay-charge-later">
                <span>Perubahan tagihan belum disimpan</span>
                <strong>{formatRupiah(pendingBill)}</strong>
              </p>
            )}
            {roomAdjustments
              .filter((item) => item.amount < 0)
              .map((item) => (
                <p className="guest-stay-charge-later" key={item.id}>
                  <span>
                    Kredit perubahan kamar · {item.from} → {item.to}
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
                    <span>Selisih perubahan kamar · {item.to}</span>
                    <strong>Bayar Nanti · {formatRupiah(item.amount)}</strong>
                  </p>
                ))}
            {balance > 0 &&
              assignedRooms
                .filter((room) => room.bed?.paymentChoice === "later")
                .map((room) => (
                  <p className="guest-stay-charge-later" key={room.key}>
                    <span>Extra Bed · Room {room.number}</span>
                    <strong>
                      Bayar Nanti · {formatRupiah(room.bed!.chargeAmount)}
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
                    <strong>Bayar Nanti · {formatRupiah(item.amount)}</strong>
                  </p>
                ))}
          </Section>
          <Section title="Security Deposit">
            <div className="guest-stay-deposit">
              <div>
                <strong>
                  {guest.deposit > 0
                    ? formatRupiah(guest.deposit)
                    : "No Deposit"}
                </strong>
                <p>
                  {guest.deposit > 0
                    ? isCheckedOut
                      ? "Settlement required after check-out."
                      : "Held separately from room and add-on charges."
                    : "No security deposit recorded for this booking."}
                </p>
              </div>
              <span
                className={
                  "reservations-badge reservations-badge--" +
                  (guest.deposit > 0 ? "info" : "neutral")
                }
              >
                {guest.deposit > 0 ? "Held" : "None"}
              </span>
            </div>
          </Section>
          <Section title="Internal Operational Notes">
            <p className="guest-stay-empty">
              No internal notes have been recorded.
            </p>
          </Section>
        </div>
        <aside className="guest-stay-summary">
          <div className="guest-stay-summary-head">
            <h2>Stay Summary</h2>
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
            <Info label="Guest" value={guest.guestName} />
            <Info
              label="Assigned Rooms"
              value={`${assignedRooms.length} Rooms · ${assignedRooms.map((room) => room.number).join(", ")}`}
            />
            <Info
              label="Stay"
              value={`${dateLabel(guest.checkIn)} – ${dateLabel(checkOut)}`}
            />
            <Info label="Booking Total" value={formatRupiah(total)} />
            {pendingBill !== 0 && (
              <Info label="Pending Bill" value={formatRupiah(pendingBill)} />
            )}
            <Info label="Total Paid" value={formatRupiah(amountPaid)} />
            <Info
              label="Security Deposit"
              value={
                guest.deposit > 0 ? formatRupiah(guest.deposit) : "No Deposit"
              }
            />
          </div>
          <div className="guest-stay-summary-balance">
            <span>{refundDue > 0 ? "Refund Due" : "Remaining Balance"}</span>
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
                    Record Payment
                  </button>
                )}
                <button
                  type="button"
                  className="guest-stay-button guest-stay-button--bill"
                  onClick={saveBill}
                  disabled={!hasPendingBillChanges}
                >
                  Save Bill
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
                    Check Out Guest
                  </button>
                )}
                <button
                  type="button"
                  className="guest-stay-button guest-stay-button--outline"
                  onClick={openExtend}
                >
                  Extend Stay
                </button>
              </>
            )}
            {isCheckedOut && (
              <p className="guest-stay-empty">
                Guest stay has been concluded for this demo view.
              </p>
            )}
          </div>
          {balance > 0 && (
            <p className="guest-stay-summary-note">
              Check-out dengan sisa tagihan memerlukan konfirmasi dan alasan petugas.
            </p>
          )}
          {hasPendingBillChanges && (
            <p className="guest-stay-summary-note">
              Simpan perubahan tagihan sebelum menyelesaikan check-out.
            </p>
          )}
          {refundDue > 0 && (
            <p className="guest-stay-summary-note">
              Selisih pembayaran perlu direfund secara manual.
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
                  ? "Record Payment"
                  : modal === "extend"
                    ? "Extend Stay"
                    : "Check Out Guest"}
              </h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="Close modal"
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
                    Remaining balance: <strong>{formatRupiah(balance)}</strong>
                  </p>
                  {balance > 0 && <div className="guest-stay-outstanding-checkout">
                    <p>Sisa tagihan tetap tercatat setelah check-out.</p>
                    <label className="guest-stay-modal-check">
                      <input type="checkbox" checked={checkoutBalanceAcknowledged} onChange={(event) => setCheckoutBalanceAcknowledged(event.target.checked)} />
                      <span>Saya menyetujui check-out dengan pembayaran belum lunas.</span>
                    </label>
                    <label className="guest-stay-outstanding-reason">Alasan <span>*</span>
                      <textarea value={checkoutOutstandingReason} onChange={(event) => setCheckoutOutstandingReason(event.target.value)} placeholder="Jelaskan alasan check-out sebelum pelunasan" rows={3} />
                    </label>
                  </div>}
                  <label>
                    Payment amount
                    <input
                      type="number"
                      min="1"
                      max={balance}
                      value={paymentInput}
                      onChange={(event) => setPaymentInput(event.target.value)}
                    />
                  </label>
                  <small>
                    Pembayaran dicatat hanya selama tampilan demo ini terbuka.
                  </small>
                </>
              )}
              {modal === "extend" && (
                <>
                  <p>
                    Current check-out: <strong>{dateLabel(checkOut)}</strong>
                  </p>
                  <label>
                    New check-out date
                    <input
                      type="date"
                      value={extensionDate}
                      onChange={(event) => setExtensionDate(event.target.value)}
                    />
                  </label>
                  <small>
                    Tambahan malam menggunakan tarif kamar{" "}
                    {formatRupiah(roomRate)} per malam.
                  </small>
                </>
              )}
              {modal === "checkout" && (
                <>
                  <p>
                    Remaining balance: <strong>{formatRupiah(balance)}</strong>
                  </p>
                  <p>
                    Security deposit:{" "}
                    <strong>
                      {guest.deposit > 0
                        ? formatRupiah(guest.deposit)
                        : "No Deposit"}
                    </strong>
                  </p>
                  {guest.deposit > 0 && (
                    <p>
                      Deposit perlu direfund atau diselesaikan oleh petugas
                      setelah check-out.
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
                        Saya sudah meninjau potensi biaya lewat waktu bersama
                        supervisor.
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
                Cancel
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
                  ? "Save Payment"
                  : modal === "extend"
                    ? "Confirm Extension"
                    : "Confirm Check-out"}
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
              <h2 id="guest-stay-extra-title">Add Experience or Add-on</h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="guest-stay-modal-body">
              <label>
                Item
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
                Harga satuan:{" "}
                <strong>
                  {chosenExtra
                    ? `${formatRupiah(chosenExtra.price)} ${chosenExtra.unit}`
                    : "—"}
                </strong>
              </p>
              <label>
                Jumlah
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
                  Jumlah malam
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
                <span>Tambahan ke tagihan</span>
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
                Cancel
              </button>
              <button
                type="button"
                className="guest-stay-button guest-stay-button--primary"
                onClick={addExtra}
              >
                Add Item
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
              <h2 id="guest-stay-room-title">Change Room</h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="guest-stay-modal-body">
              <p>
                Current room:{" "}
                <strong>
                  {activeRoom.name} · {activeRoom.number}
                </strong>{" "}
                ({formatRupiah(roomRate)} / malam)
              </p>
              <p>
                Pilihan kamar untuk periode {dateLabel(guest.checkIn)} –{" "}
                {dateLabel(checkOut)}.
              </p>
              <label>
                New room
                <select
                  value={selectedRoomNumber}
                  onChange={(event) => {
                    setSelectedRoomNumber(event.target.value);
                    setError("");
                  }}
                >
                  {availableRooms.map((option) => (
                    <option key={option.number} value={option.number}>
                      {option.type} · {option.number} ·{" "}
                      {formatRupiah(option.rate)} / malam
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Jumlah malam yang disesuaikan
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
                  Tarif extra bed untuk kamar baru juga ikut disesuaikan:{" "}
                  {formatRupiah(
                    extraBedRates[selectedRoom?.type ?? activeRoom.name] ??
                      150000,
                  )}{" "}
                  / malam.
                </small>
              )}
              <div className="guest-stay-extra-preview">
                <span>
                  {roomDifference < 0
                    ? "Kredit downgrade"
                    : roomDifference > 0
                      ? "Tambahan upgrade"
                      : "Selisih harga"}
                </span>
                <strong>
                  {roomDifference < 0 ? "−" : roomDifference > 0 ? "+" : ""}
                  {formatRupiah(Math.abs(roomDifference))}
                </strong>
              </div>
              {roomDifference < 0 && (
                <small>
                  Jika pembayaran melebihi total baru, selisih ditampilkan
                  sebagai Refund Due.
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
                Cancel
              </button>
              <button
                type="button"
                className="guest-stay-button guest-stay-button--primary"
                onClick={changeRoom}
                disabled={!selectedRoom}
              >
                Confirm Change
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
              <h2 id="guest-stay-bed-title">Manage Extra Bed</h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="guest-stay-modal-body">
              <p>
                {activeRoom.name} · {activeRoom.number} · 1 extra bed maksimum
              </p>
              <label>
                Extra bed
                <select
                  value={bedEnabled ? "1" : "0"}
                  onChange={(event) =>
                    setBedEnabled(event.target.value === "1")
                  }
                >
                  <option value="1">1 Extra Bed</option>
                  <option value="0">No Extra Bed</option>
                </select>
              </label>
              {bedEnabled && (
                <label>
                  Jumlah malam
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
                Tarif {activeRoom.name}:{" "}
                <strong>{formatRupiah(bedRate)} / bed / malam</strong>
              </p>
              <div className="guest-stay-extra-preview">
                <span>Perubahan tagihan</span>
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
                Cancel
              </button>
              <button
                type="button"
                className="guest-stay-button guest-stay-button--primary"
                onClick={manageBed}
              >
                Save Extra Bed
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

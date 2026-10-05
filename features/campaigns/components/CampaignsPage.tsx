"use client";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { Icon } from "../../../components/ui/Icon";
import { restoreSession } from "../../../lib/auth";
import { formatStayDate } from "../../reservations/constants/walk-in-data";
import {
  deleteCampaign,
  listCampaignRoomTypes,
  listCampaigns,
  setCampaignStatus,
  type CampaignRecord,
  type CampaignRoomTypeOption,
} from "../services/campaigns";

// ─── Sub-components ──────────────────────────────────────────────────────────

function DiscountBadge({ campaign }: { campaign: CampaignRecord }) {
  const isActive = campaign.isActive;
  return (
    <span
      className={
        isActive ? "campaign-discount campaign-discount--active" : "campaign-discount"
      }
    >
      {campaign.discountType === "percent"
        ? `${campaign.discountValue}% Off`
        : `Rp ${new Intl.NumberFormat("id-ID").format(campaign.discountValue)} Off`}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={
        isActive
          ? "campaign-status campaign-status--active"
          : "campaign-status campaign-status--inactive"
      }
    >
      <i />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span className="campaign-priority" title={`Priority ${priority}`}>
      {priority}
    </span>
  );
}

function RoomTypeCell({
  campaign,
  roomTypes,
}: {
  campaign: CampaignRecord;
  roomTypes: CampaignRoomTypeOption[];
}) {
  const isAll = campaign.roomTypeIds.length === 0;
  if (isAll) {
    return <span className="campaign-room-all">All Room Types</span>;
  }
  return (
    <span className="campaign-room-list">
      {campaign.roomTypeIds.map((id) => roomTypes.find((room) => room.id === id)?.name ?? id).join(", ")}
    </span>
  );
}

function formatPeriod(start: string | null, end: string | null) {
  return `${start ? formatStayDate(start) : "Any date"} — ${end ? formatStayDate(end) : "Any date"}`;
}

function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function stayPeriodState(start: string | null, end: string | null, today: string | null) {
  if (!today) return null;
  if (end && end < today) return "expired";
  if (start && start > today) return "upcoming";
  return "current";
}

function CampaignRow({
  campaign,
  roomTypes,
  today,
  onStatusChange,
  onDelete,
  busy,
}: {
  campaign: CampaignRecord;
  roomTypes: CampaignRoomTypeOption[];
  today: string | null;
  onStatusChange: (campaign: CampaignRecord) => void;
  onDelete: (campaign: CampaignRecord) => void;
  busy: boolean;
}) {
  const stayState = stayPeriodState(campaign.stayStart, campaign.stayEnd, today);
  return (
    <tr className={`campaigns-table__row${stayState === "current" ? " campaigns-table__row--stay-current" : stayState === "expired" ? " campaigns-table__row--stay-expired" : ""}`}>
      {/* Campaign Name + Promo Code */}
      <td className="campaigns-table__td">
        <div className="campaign-name-cell">
          <span
            className={
              campaign.isActive
                ? "campaign-name campaign-name--active"
                : "campaign-name"
            }
          >
            {campaign.name}
          </span>
          <div className="campaign-code-wrap">
            {campaign.promoCode ? (
              <span className="campaign-code">
                Code: <span>{campaign.promoCode}</span>
              </span>
            ) : (
              <span className="campaign-code campaign-code--auto">
                No Code (Auto-applied)
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Room Type */}
      <td className="campaigns-table__td">
        <RoomTypeCell campaign={campaign} roomTypes={roomTypes} />
      </td>

      <td className="campaigns-table__td campaigns-table__td--muted">
        {campaign.channel === "website" ? "Website" : "Front Desk"}
      </td>

      {/* Booking Period */}
      <td className="campaigns-table__td campaigns-table__td--muted">
        {formatPeriod(campaign.bookingStart, campaign.bookingEnd)}
      </td>

      {/* Stay Period */}
      <td className="campaigns-table__td campaigns-table__td--medium">
        {formatPeriod(campaign.stayStart, campaign.stayEnd)}
      </td>

      {/* Discount */}
      <td className="campaigns-table__td">
        <DiscountBadge campaign={campaign} />
      </td>

      {/* Min Night */}
      <td className="campaigns-table__td campaigns-table__td--muted">
        {campaign.minNights === 1 ? "1 Night" : `${campaign.minNights} Nights`}
      </td>

      {/* Priority */}
      <td className="campaigns-table__td campaigns-table__td--center">
        <PriorityBadge priority={campaign.priority} />
      </td>

      {/* Status */}
      <td className="campaigns-table__td">
        <StatusBadge isActive={campaign.isActive} />
      </td>

      {/* Actions */}
      <td className="campaigns-table__td campaigns-table__td--right">
        <div className="campaign-actions">
          <button
            type="button"
            role="switch"
            aria-checked={campaign.isActive}
            aria-label={`${campaign.isActive ? "Disable" : "Enable"} ${campaign.name}`}
            title={campaign.isActive ? "Disable campaign" : "Enable campaign"}
            className={`campaign-actions__switch${campaign.isActive ? " campaign-actions__switch--active" : ""}`}
            disabled={busy}
            onClick={() => onStatusChange(campaign)}
          >
            <span />
          </button>
          <Link href={`/campaigns/${campaign.id}/edit`} className="text-action">
            Edit
          </Link>
          <button
            type="button"
            className="text-action campaign-actions__delete"
            disabled={busy}
            onClick={() => onDelete(campaign)}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function CampaignsPage() {
  const [today, setToday] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [roomFilter, setRoomFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<"all" | "website" | "front_desk">("all");
  const [roomTypes, setRoomTypes] = useState<CampaignRoomTypeOption[]>([]);
  const [items, setItems] = useState<CampaignRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [campaignToDelete, setCampaignToDelete] = useState<CampaignRecord | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const limit = 20;

  useEffect(() => {
    const refreshToday = () => setToday(jakartaToday());
    refreshToday();
    const interval = window.setInterval(refreshToday, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        if (!(await restoreSession())) return;
        setRoomTypes(await listCampaignRoomTypes(controller.signal));
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Room types gagal dimuat.");
        }
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        try {
          if (!(await restoreSession())) return;
          const query = new URLSearchParams({ page: String(page), limit: String(limit) });
          if (search.trim()) query.set("search", search.trim());
          if (statusFilter !== "all") query.set("isActive", String(statusFilter === "Active"));
          if (roomFilter !== "all") query.set("roomTypeId", roomFilter);
          if (channelFilter !== "all") query.set("channel", channelFilter);
          const result = await listCampaigns(query, controller.signal);
          if (controller.signal.aborted) return;
          if (page > 1 && result.items.length === 0 && result.total > 0) {
            setPage(page - 1);
            return;
          }
          setItems(result.items);
          setTotal(result.total);
        } catch (cause) {
          if (!controller.signal.aborted) {
            setItems([]);
            setError(cause instanceof Error ? cause.message : "Campaign gagal dimuat.");
          }
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }, search ? 250 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [search, statusFilter, roomFilter, channelFilter, page, reload]);

  async function toggleStatus(campaign: CampaignRecord) {
    setBusyId(campaign.id);
    setError("");
    try {
      await setCampaignStatus(campaign.id, !campaign.isActive);
      setReload((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Status campaign gagal diubah.");
    } finally {
      setBusyId("");
    }
  }

  async function confirmDelete() {
    if (!campaignToDelete) return;
    const campaign = campaignToDelete;
    setBusyId(campaign.id);
    setError("");
    try {
      await deleteCampaign(campaign.id);
      setCampaignToDelete(null);
      setReload((current) => current + 1);
    } catch (cause) {
      setCampaignToDelete(null);
      setError(cause instanceof Error ? cause.message : "Campaign gagal dihapus.");
    } finally {
      setBusyId("");
    }
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setRoomFilter("all");
    setChannelFilter("all");
    setPage(1);
  }

  const hasActiveFilters =
    search !== "" || statusFilter !== "all" || roomFilter !== "all" || channelFilter !== "all";

  return (
    <AdminShell
      title="Operations"
      context="Campaigns & Promotions"
    >
      <div className="campaigns-page">
        {/* Page header */}
        <div className="campaigns-heading">
          <div>
            <h1>Campaigns &amp; Promotions</h1>
            <p>
              Kelola promo yang berlaku berdasarkan periode, tipe kamar, dan
              aturan booking
            </p>
          </div>
          <Link href="/campaigns/add" className="action-button">
            <Icon name="plus" />
            <span>+ Add Campaign</span>
          </Link>
        </div>

        {/* Filter bar */}
        <div className="campaigns-filter-bar">
          <div className="campaigns-filter-bar__inputs">
            {/* Search */}
            <div className="campaigns-search-wrap">
              <Icon
                name="search"
                className="campaigns-search-icon"
                width={16}
                height={16}
              />
              <input
                type="text"
                className="campaigns-search"
                placeholder="Search campaign name or promo code..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            {/* Status filter */}
            <div className="campaigns-select-wrap">
              <select
                className="campaigns-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as typeof statusFilter);
                  setPage(1);
                }}
              >
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <Icon
                name="chevron"
                className="campaigns-select-chevron"
                width={14}
                height={14}
              />
            </div>

            <div className="campaigns-select-wrap">
              <select
                className="campaigns-select"
                aria-label="Filter channel"
                value={channelFilter}
                onChange={(e) => {
                  setChannelFilter(e.target.value as typeof channelFilter);
                  setPage(1);
                }}
              >
                <option value="all">All Channels</option>
                <option value="website">Website</option>
                <option value="front_desk">Front Desk</option>
              </select>
              <Icon name="chevron" className="campaigns-select-chevron" width={14} height={14} />
            </div>

            {/* Room type filter */}
            <div className="campaigns-select-wrap">
              <select
                className="campaigns-select"
                value={roomFilter}
                onChange={(e) => { setRoomFilter(e.target.value); setPage(1); }}
              >
                <option value="all">All Room Types</option>
                {roomTypes.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
              <Icon
                name="chevron"
                className="campaigns-select-chevron"
                width={14}
                height={14}
              />
            </div>
          </div>

          {/* Reset */}
          {hasActiveFilters && (
            <button
              type="button"
              className="campaigns-reset-button"
              onClick={resetFilters}
            >
              <Icon name="reset" width={14} height={14} />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        {error && <div className="campaigns-api-message" role="alert">{error}</div>}

        {/* Table */}
        <div className="data-panel">
          <div className="table-scroll">
            <table className="campaigns-table">
              <thead>
                <tr className="campaigns-table__head-row">
                  <th className="campaigns-table__th">Campaign Name</th>
                  <th className="campaigns-table__th">Room Type</th>
                  <th className="campaigns-table__th">Channel</th>
                  <th className="campaigns-table__th">Booking Period</th>
                  <th className="campaigns-table__th">Stay Period</th>
                  <th className="campaigns-table__th">Discount</th>
                  <th className="campaigns-table__th">Min. Night</th>
                  <th className="campaigns-table__th campaigns-table__th--center">
                    Priority
                  </th>
                  <th className="campaigns-table__th">Status</th>
                  <th className="campaigns-table__th campaigns-table__th--right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {!loading && items.length > 0 ? (
                  items.map((campaign) => (
                    <CampaignRow
                      key={campaign.id}
                      campaign={campaign}
                      roomTypes={roomTypes}
                      today={today}
                      busy={busyId === campaign.id}
                      onStatusChange={toggleStatus}
                      onDelete={setCampaignToDelete}
                    />
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={10}
                      className="campaigns-table__empty"
                    >
                      {loading ? <LoadingSkeleton /> : "Tidak ada campaign yang sesuai filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="campaigns-pagination">
            <span className="campaigns-pagination__info">
              Showing{" "}
              <strong>
                {total > 0 ? (page - 1) * limit + 1 : 0}–{Math.min(page * limit, total)}
              </strong>{" "}
              of <strong>{total}</strong> campaigns
            </span>
            <div className="campaigns-pagination__controls">
              <button
                type="button"
                className="campaigns-pagination__btn"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
              >
                <Icon name="chevronLeft" width={14} height={14} />
                <span>Previous</span>
              </button>
              <button
                type="button"
                className="campaigns-pagination__page campaigns-pagination__page--active"
              >
                {page}
              </button>
              <button
                type="button"
                className="campaigns-pagination__btn"
                disabled={page * limit >= total || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                <span>Next</span>
                <Icon name="chevronRight" width={14} height={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Priority notice */}
        <div className="campaigns-notice">
          <Icon
            name="info"
            className="campaigns-notice__icon"
            width={18}
            height={18}
          />
          <p>
            <strong>Catatan Prioritas Promo:</strong> Jika beberapa campaign
            aktif pada channel, tipe kamar, dan tanggal menginap yang
            sama, sistem secara otomatis menerapkan promo dengan Prioritas
            tertinggi (angka 1 = prioritas utama). Promo tidak dapat digabung
            (non-stackable).
          </p>
        </div>

        {campaignToDelete && (
          <div className="campaign-delete-overlay" role="presentation">
            <section
              className="campaign-delete-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="campaign-delete-title"
            >
              <h2 id="campaign-delete-title">Delete Campaign?</h2>
              <p>
                Hapus <strong>{campaignToDelete.name}</strong>? Riwayat promo pada
                reservasi tetap tersimpan sebagai snapshot. Priority campaign
                lain dalam channel yang sama akan diperbarui otomatis.
              </p>
              <div className="campaign-delete-dialog__actions">
                <button type="button" disabled={busyId === campaignToDelete.id} onClick={() => setCampaignToDelete(null)}>
                  Cancel
                </button>
                <button type="button" className="campaign-delete-dialog__confirm" disabled={busyId === campaignToDelete.id} onClick={() => void confirmDelete()}>
                  {busyId === campaignToDelete.id ? "Deleting..." : "Delete Campaign"}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

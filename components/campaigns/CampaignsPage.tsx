"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../layout/AdminShell";
import { Icon } from "../ui/Icon";
import {
  campaigns as allCampaigns,
  formatBookingPeriod,
  formatDiscount,
  formatMinNights,
  formatRoomTypes,
  formatStayPeriod,
  ALL_ROOM_TYPE_OPTIONS,
  type Campaign,
} from "../../lib/campaigns-data";

// ─── Sub-components ──────────────────────────────────────────────────────────

function DiscountBadge({ campaign }: { campaign: Campaign }) {
  const isActive = campaign.status === "Active";
  return (
    <span
      className={
        isActive ? "campaign-discount campaign-discount--active" : "campaign-discount"
      }
    >
      {formatDiscount(campaign)}
    </span>
  );
}

function StatusBadge({ status }: { status: Campaign["status"] }) {
  return (
    <span
      className={
        status === "Active"
          ? "campaign-status campaign-status--active"
          : "campaign-status campaign-status--inactive"
      }
    >
      <i />
      {status}
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

function RoomTypeCell({ campaign }: { campaign: Campaign }) {
  const isAll = campaign.roomTypes.length === 0;
  if (isAll) {
    return <span className="campaign-room-all">All Room Types</span>;
  }
  return (
    <span className="campaign-room-list">
      {campaign.roomTypes.join(", ")}
    </span>
  );
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  return (
    <tr className="campaigns-table__row">
      {/* Campaign Name + Promo Code */}
      <td className="campaigns-table__td">
        <div className="campaign-name-cell">
          <span
            className={
              campaign.status === "Active"
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
        <RoomTypeCell campaign={campaign} />
      </td>

      {/* Booking Period */}
      <td className="campaigns-table__td campaigns-table__td--muted">
        {formatBookingPeriod(campaign)}
      </td>

      {/* Stay Period */}
      <td className="campaigns-table__td campaigns-table__td--medium">
        {formatStayPeriod(campaign)}
      </td>

      {/* Discount */}
      <td className="campaigns-table__td">
        <DiscountBadge campaign={campaign} />
      </td>

      {/* Min Night */}
      <td className="campaigns-table__td campaigns-table__td--muted">
        {formatMinNights(campaign)}
      </td>

      {/* Priority */}
      <td className="campaigns-table__td campaigns-table__td--center">
        <PriorityBadge priority={campaign.priority} />
      </td>

      {/* Status */}
      <td className="campaigns-table__td">
        <StatusBadge status={campaign.status} />
      </td>

      {/* Actions */}
      <td className="campaigns-table__td campaigns-table__td--right">
        <div className="campaign-actions">
          <Link href={`/campaigns/${campaign.id}/edit`} className="text-action">
            Edit
          </Link>
          <button
            type="button"
            className="campaign-more-button"
            aria-label="Aksi lainnya"
            title="Aksi lainnya"
          >
            <Icon name="more" width={18} height={18} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function CampaignsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [roomFilter, setRoomFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return allCampaigns.filter((c) => {
      const matchSearch =
        search.trim() === "" ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.promoCode?.toLowerCase().includes(search.toLowerCase()) ?? false);

      const matchStatus =
        statusFilter === "all" || c.status === statusFilter;

      const matchRoom =
        roomFilter === "all" ||
        c.roomTypes.length === 0 || // "All Room Types" campaigns always match
        c.roomTypes.includes(roomFilter);

      return matchSearch && matchStatus && matchRoom;
    });
  }, [search, statusFilter, roomFilter]);

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setRoomFilter("all");
  }

  const hasActiveFilters =
    search !== "" || statusFilter !== "all" || roomFilter !== "all";

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
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Status filter */}
            <div className="campaigns-select-wrap">
              <select
                className="campaigns-select"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as typeof statusFilter)
                }
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

            {/* Room type filter */}
            <div className="campaigns-select-wrap">
              <select
                className="campaigns-select"
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
              >
                <option value="all">All Room Types</option>
                {ALL_ROOM_TYPE_OPTIONS.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt}
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

        {/* Table */}
        <div className="data-panel">
          <div className="table-scroll">
            <table className="campaigns-table">
              <thead>
                <tr className="campaigns-table__head-row">
                  <th className="campaigns-table__th">Campaign Name</th>
                  <th className="campaigns-table__th">Room Type</th>
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
                {filtered.length > 0 ? (
                  filtered.map((campaign) => (
                    <CampaignRow key={campaign.id} campaign={campaign} />
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={9}
                      className="campaigns-table__empty"
                    >
                      Tidak ada campaign yang sesuai filter.
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
                {filtered.length > 0 ? "1" : "0"}–{filtered.length}
              </strong>{" "}
              of <strong>{filtered.length}</strong> campaigns
            </span>
            <div className="campaigns-pagination__controls">
              <button
                type="button"
                className="campaigns-pagination__btn"
                disabled
              >
                <Icon name="chevronLeft" width={14} height={14} />
                <span>Previous</span>
              </button>
              <button
                type="button"
                className="campaigns-pagination__page campaigns-pagination__page--active"
              >
                1
              </button>
              <button
                type="button"
                className="campaigns-pagination__btn"
                disabled
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
            aktif memenuhi syarat pada tipe kamar dan tanggal menginap yang
            sama, sistem secara otomatis menerapkan promo dengan Prioritas
            tertinggi (angka 1 = prioritas utama). Promo tidak dapat digabung
            (non-stackable).
          </p>
        </div>
      </div>
    </AdminShell>
  );
}

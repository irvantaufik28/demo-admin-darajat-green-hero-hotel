"use client";

import "../styles/favorite-rooms.css";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { restoreSession } from "../../../lib/auth";
import { useTranslations } from "../../../lib/i18n";
import {
  getActiveRoomTypes,
  getFavoriteRooms,
  saveFavoriteRooms,
  type FavoriteRoom,
  type SelectableRoomType,
} from "../services/favorite-rooms";
import en from "../locales/en.json";
import id from "../locales/id.json";

const MAX_FAVORITES = 12;

function selectionKey(items: FavoriteRoom[]) {
  return JSON.stringify(items.map(({ roomTypeId, isActive }) => ({ roomTypeId, isActive })));
}

function fromRoomType(room: SelectableRoomType): FavoriteRoom {
  return {
    roomTypeId: room.id,
    sortOrder: 0,
    isActive: true,
    roomTypeIsActive: true,
    slug: "",
    name: room.name,
    description: room.description,
    sizeSqm: null,
    maxGuests: null,
    coverImage: room.coverImage ? { url: room.coverImage.url, altText: room.coverImage.altText } : null,
    startingPrice: null,
  };
}

export function FavoriteRoomsPage() {
  const { t } = useTranslations({ en, id });
  const [selected, setSelected] = useState<FavoriteRoom[]>([]);
  const [saved, setSaved] = useState<FavoriteRoom[]>([]);
  const [catalog, setCatalog] = useState<SelectableRoomType[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        if (!(await restoreSession())) return;
        const [favorites, roomTypes] = await Promise.all([
          getFavoriteRooms(controller.signal),
          getActiveRoomTypes(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setSelected(favorites.items.map((room) => room.roomTypeIsActive ? room : { ...room, isActive: false }));
        setSaved(favorites.items);
        setCatalog(roomTypes.items);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : t("favoriteRooms.loadError"));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const dirty = selectionKey(selected) !== selectionKey(saved);
  const selectedIds = useMemo(() => new Set(selected.map((room) => room.roomTypeId)), [selected]);
  const available = catalog.filter((room) =>
    !selectedIds.has(room.id) && room.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function edit(next: FavoriteRoom[]) {
    setSelected(next);
    setError("");
    setNotice("");
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= selected.length) return;
    const next = [...selected];
    [next[index], next[target]] = [next[target], next[index]];
    edit(next);
  }

  async function save() {
    if (!dirty || saving || loading) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await saveFavoriteRooms(selected.map(({ roomTypeId, isActive }) => ({ roomTypeId, isActive })));
      setSelected(result.items);
      setSaved(result.items);
      setNotice(t("favoriteRooms.saved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("favoriteRooms.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title={t("favoriteRooms.context")} context={t("favoriteRooms.title")}>
      <div className="favorite-rooms-page">
        <header className="favorite-rooms-header">
          <div>
            <span className="favorite-rooms-eyebrow">{t("favoriteRooms.eyebrow")}</span>
            <h1>{t("favoriteRooms.title")}</h1>
            <p>{t("favoriteRooms.description")}</p>
          </div>
          <div className="favorite-rooms-actions">
            {dirty && <span className="favorite-rooms-unsaved">● {t("favoriteRooms.unsaved")}</span>}
            <button type="button" className="favorite-rooms-secondary" disabled={!dirty || saving} onClick={() => edit(saved)}>
              {t("favoriteRooms.reset")}
            </button>
            <button type="button" className="action-button" disabled={!dirty || saving || loading} onClick={() => void save()}>
              {saving ? t("favoriteRooms.saving") : t("favoriteRooms.save")}
            </button>
          </div>
        </header>

        {error && <p className="favorite-rooms-message favorite-rooms-message--error" role="alert">{error}</p>}
        {notice && <p className="favorite-rooms-message favorite-rooms-message--success" role="status">{notice}</p>}

        <section className="favorite-rooms-panel" aria-labelledby="favorite-rooms-selected-title">
          <div className="favorite-rooms-panel-heading">
            <div>
              <h2 id="favorite-rooms-selected-title">{t("favoriteRooms.selectedTitle")}</h2>
              <p>{t("favoriteRooms.selectedDescription")}</p>
            </div>
            <strong>{selected.length}/{MAX_FAVORITES}</strong>
          </div>
          {loading ? <LoadingSkeleton variant="table" rows={4} /> : selected.length === 0 ? (
            <p className="favorite-rooms-empty">{t("favoriteRooms.emptySelected")}</p>
          ) : (
            <ol className="favorite-rooms-list">
              {selected.map((room, index) => (
                <li key={room.roomTypeId} className="favorite-rooms-item">
                  <span className="favorite-rooms-order">{index + 1}</span>
                  <div className="favorite-rooms-thumbnail">
                    {room.coverImage && <img src={room.coverImage.url} alt={room.coverImage.altText || room.name} />}
                  </div>
                  <div className="favorite-rooms-item-body">
                    <strong>{room.name}</strong>
                    <span>
                      {room.maxGuests !== null && t("favoriteRooms.guestCount", { count: room.maxGuests })}
                      {room.maxGuests !== null && room.startingPrice !== null && " · "}
                      {room.startingPrice !== null && t("favoriteRooms.priceFrom", { price: room.startingPrice.toLocaleString("id-ID") })}
                    </span>
                    {!room.roomTypeIsActive && <small className="favorite-rooms-inactive">{t("favoriteRooms.inactiveRoom")}</small>}
                  </div>
                  <label className="favorite-rooms-toggle">
                    <input type="checkbox" checked={room.isActive} disabled={!room.roomTypeIsActive || saving} onChange={(event) => edit(selected.map((item, itemIndex) => itemIndex === index ? { ...item, isActive: event.target.checked } : item))} />
                    <span>{t("favoriteRooms.active")}</span>
                  </label>
                  <div className="favorite-rooms-item-actions">
                    <button type="button" disabled={index === 0 || saving} title={t("favoriteRooms.moveUp")} aria-label={`${t("favoriteRooms.moveUp")}: ${room.name}`} onClick={() => move(index, -1)}>↑</button>
                    <button type="button" disabled={index === selected.length - 1 || saving} title={t("favoriteRooms.moveDown")} aria-label={`${t("favoriteRooms.moveDown")}: ${room.name}`} onClick={() => move(index, 1)}>↓</button>
                    <button type="button" disabled={saving} className="favorite-rooms-remove" onClick={() => edit(selected.filter((item) => item.roomTypeId !== room.roomTypeId))}>{t("favoriteRooms.remove")}</button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="favorite-rooms-panel" aria-labelledby="favorite-rooms-available-title">
          <div className="favorite-rooms-panel-heading">
            <div>
              <h2 id="favorite-rooms-available-title">{t("favoriteRooms.availableTitle")}</h2>
              <p>{t("favoriteRooms.availableDescription")}</p>
            </div>
          </div>
          <input className="favorite-rooms-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("favoriteRooms.search")} aria-label={t("favoriteRooms.search")} />
          {!loading && selected.length >= MAX_FAVORITES && <p className="favorite-rooms-limit">{t("favoriteRooms.limit")}</p>}
          {loading ? <LoadingSkeleton variant="table" rows={3} /> : available.length === 0 ? (
            <p className="favorite-rooms-empty">{t("favoriteRooms.emptyAvailable")}</p>
          ) : (
            <div className="favorite-rooms-catalog">
              {available.map((room) => (
                <div key={room.id} className="favorite-rooms-catalog-item">
                  <div className="favorite-rooms-thumbnail">
                    {room.coverImage && <img src={room.coverImage.url} alt={room.coverImage.altText || room.name} />}
                  </div>
                  <div className="favorite-rooms-item-body"><strong>{room.name}</strong><span>{room.description || "—"}</span></div>
                  <button type="button" className="favorite-rooms-secondary" disabled={selected.length >= MAX_FAVORITES || saving} onClick={() => edit([...selected, fromRoomType(room)])}>＋ {t("favoriteRooms.add")}</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

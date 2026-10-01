"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminShell } from "../layout/AdminShell";
import {
  addRoomType,
  amenityGroups,
  defaultCapacityPatterns,
  getRoomTypeById,
  updateRoomType,
  type CapacityPattern,
  type RoomPhoto,
  type RoomTypeEntry,
} from "../../lib/rooms-data";

const steps = ["Basic Info", "Photos", "Amenities", "Capacity"] as const;
const descriptions = [
  "Tambahkan informasi dasar tipe kamar",
  "Tambahkan foto untuk tipe kamar",
  "Pilih fasilitas yang tersedia untuk tipe kamar ini",
  "Atur kapasitas tamu untuk tipe kamar",
];

const initialRoom: RoomTypeEntry = {
  id: "",
  name: "Deluxe Mountain View Room",
  description: "Kamar luas berkonsep kayu alami dengan balkon privat menghadap panorama lembah kawah Darajat.",
  active: true,
  size: 32,
  bedType: "King Bed",
  bedCount: 1,
  mealType: "Full Board",
  adultBreakfastPrice: 75000,
  childBreakfastPrice: 50000,
  extraBedEnabled: true,
  extraBedPrice: 200000,
  maxExtraBeds: 1,
  cover: null,
  gallery: [],
  amenities: ["Air Conditioning", "Balcony", "Mountain View", "Wardrobe", "Hot Water", "Shower", "Towels", "WiFi"],
  capacityPatterns: defaultCapacityPatterns.map((pattern) => ({ ...pattern })),
};

function formatPrice(value: number) {
  return `Rp${value.toLocaleString("id-ID")}`;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="room-wizard-field">
      <span>{label}{required && <b> *</b>}</span>
      {children}
    </label>
  );
}

function BasicInfo({ room, update }: { room: RoomTypeEntry; update: (values: Partial<RoomTypeEntry>) => void }) {
  return (
    <div className="room-wizard-sections">
      <section className="room-wizard-section">
        <div className="room-wizard-section-head">
          <h2>Basic Information</h2>
          <div className="room-wizard-status-toggle" aria-label="Room type status">
            <button type="button" className={room.active ? "is-active" : ""} onClick={() => update({ active: true })}>● Active</button>
            <button type="button" className={!room.active ? "is-inactive" : ""} onClick={() => update({ active: false })}>● Inactive</button>
          </div>
        </div>
        <Field label="Room Type Name" required>
          <input value={room.name} maxLength={100} onChange={(event) => update({ name: event.target.value })} placeholder="Enter room type name" />
        </Field>
        <Field label="Description">
          <textarea value={room.description} maxLength={1000} rows={3} onChange={(event) => update({ description: event.target.value })} placeholder="Describe the room" />
          <small className="room-wizard-field-note">{room.description.length} / 1000</small>
        </Field>
      </section>

      <section className="room-wizard-section">
        <h2>Room Specification</h2>
        <div className="room-wizard-field-grid">
          <Field label="Room Size (m²)" required>
            <input type="number" min="1" value={room.size} onChange={(event) => update({ size: Number(event.target.value) })} />
          </Field>
          <Field label="Bed Type">
            <select value={room.bedType} onChange={(event) => update({ bedType: event.target.value })}>
              {["King Bed", "Queen Bed", "Double Bed", "Twin Bed", "Single Bed", "Other"].map((type) => <option key={type}>{type}</option>)}
            </select>
          </Field>
          <Field label="Number of Beds">
            <input type="number" min="1" max="8" value={room.bedCount} onChange={(event) => update({ bedCount: Number(event.target.value) })} />
          </Field>
        </div>
      </section>

      <section className="room-wizard-section">
        <h2>Meal Type</h2>
        <p>Pilih paket makanan standar untuk tarif dasar kamar.</p>
        <div className="room-wizard-choice-grid">
          {[
            ["Room Only", "Tanpa sarapan"],
            ["With Breakfast", "Termasuk sarapan harian"],
            ["Full Board", "Makan 3x sehari"],
          ].map(([name, detail]) => (
            <label className={room.mealType === name ? "room-wizard-choice is-selected" : "room-wizard-choice"} key={name}>
              <input type="radio" name="meal-type" checked={room.mealType === name} onChange={() => update({ mealType: name })} />
              <span><strong>{name}</strong><small>{detail}</small></span>
            </label>
          ))}
        </div>
        {room.mealType !== "Room Only" && (
          <div className="room-wizard-breakfast">
            <strong>Rincian Tambahan Sarapan</strong>
            <div className="room-wizard-field-grid room-wizard-field-grid--two">
              <Field label="Adult Breakfast Price">
                <input type="number" min="0" value={room.adultBreakfastPrice} onChange={(event) => update({ adultBreakfastPrice: Number(event.target.value) })} />
              </Field>
              <Field label="Child Breakfast Price">
                <input type="number" min="0" value={room.childBreakfastPrice} onChange={(event) => update({ childBreakfastPrice: Number(event.target.value) })} />
              </Field>
            </div>
          </div>
        )}
      </section>

      <section className="room-wizard-section">
        <div className="room-wizard-section-head">
          <div><h2>Extra Bed</h2><p>Izinkan kasur tambahan untuk tipe kamar ini.</p></div>
          <label className="room-wizard-switch">
            <input type="checkbox" checked={room.extraBedEnabled} onChange={(event) => update({ extraBedEnabled: event.target.checked, maxExtraBeds: event.target.checked ? Math.max(1, room.maxExtraBeds) : 0 })} />
            <span />
          </label>
        </div>
        {room.extraBedEnabled && (
          <div className="room-wizard-field-grid room-wizard-field-grid--two">
            <Field label="Extra Bed Price / night">
              <input type="number" min="0" value={room.extraBedPrice} onChange={(event) => update({ extraBedPrice: Number(event.target.value) })} />
            </Field>
            <Field label="Maximum Extra Beds">
              <input type="number" min="1" max="4" value={room.maxExtraBeds} onChange={(event) => update({ maxExtraBeds: Number(event.target.value) })} />
            </Field>
          </div>
        )}
      </section>
    </div>
  );
}

function Photos({ room, update }: { room: RoomTypeEntry; update: (values: Partial<RoomTypeEntry>) => void }) {
  const coverInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState("");

  function toPhoto(file: File): RoomPhoto {
    return { id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file), size: `${(file.size / 1024 / 1024).toFixed(1)} MB` };
  }

  function receiveFiles(event: ChangeEvent<HTMLInputElement>, target: "cover" | "gallery") {
    const files = Array.from(event.target.files ?? []);
    const invalid = files.find((file) => !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024);
    if (invalid) {
      setPhotoError("Gunakan foto PNG, JPG, atau WebP dengan ukuran maksimal 10 MB.");
      event.target.value = "";
      return;
    }
    setPhotoError("");
    if (target === "cover" && files[0]) update({ cover: toPhoto(files[0]) });
    if (target === "gallery") update({ gallery: [...room.gallery, ...files.slice(0, 10 - room.gallery.length).map(toPhoto)] });
    event.target.value = "";
  }

  function movePhoto(index: number, direction: number) {
    const next = [...room.gallery];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update({ gallery: next });
  }

  return (
    <div className="room-wizard-sections">
      <section className="room-wizard-section">
        <div className="room-wizard-section-head"><div><h2>Cover Photo</h2><p>Foto utama yang akan ditampilkan pertama pada website. Gunakan foto lanskap.</p></div><span className="room-wizard-count">{room.cover ? "Uploaded" : "Not uploaded"}</span></div>
        {room.cover ? (
          <div className="room-wizard-cover">
            <img src={room.cover.url} alt="Cover tipe kamar" />
            <div>
              <strong>{room.cover.name}</strong>
              <small>{room.cover.size} · Cover Photo</small>
              <div className="room-wizard-photo-actions">
                <button type="button" onClick={() => coverInput.current?.click()}>Replace</button>
                <button type="button" onClick={() => update({ cover: null })}>Remove</button>
              </div>
            </div>
          </div>
        ) : (
          <button type="button" className="room-wizard-cover-empty" onClick={() => coverInput.current?.click()}>
            <span>▧</span><strong>Upload Cover Photo</strong><small>PNG, JPG, WebP up to 10 MB · 16:9 recommended</small>
          </button>
        )}
        <input ref={coverInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => receiveFiles(event, "cover")} />
      </section>

      <section className="room-wizard-section">
        <div className="room-wizard-section-head"><div><h2>Gallery</h2><p>Tambahkan beberapa foto untuk menampilkan detail kamar.</p></div><span className="room-wizard-count">{room.gallery.length} / 10 photos</span></div>
        <div className="room-wizard-gallery">
          {room.gallery.map((photo, index) => (
            <div className="room-wizard-photo" key={photo.id}>
              <img src={photo.url} alt={`Foto kamar ${index + 1}`} />
              <span className="room-wizard-photo-index">{index + 1}</span>
              <div><strong title={photo.name}>{photo.name}</strong><small>{photo.size}</small></div>
              <div className="room-wizard-photo-actions">
                <button type="button" onClick={() => movePhoto(index, -1)} disabled={index === 0} aria-label={`Geser ${photo.name} ke kiri`}>←</button>
                <button type="button" onClick={() => movePhoto(index, 1)} disabled={index === room.gallery.length - 1} aria-label={`Geser ${photo.name} ke kanan`}>→</button>
                <button type="button" onClick={() => update({ cover: photo })}>Set Cover</button>
                <button type="button" onClick={() => update({ gallery: room.gallery.filter((item) => item.id !== photo.id) })}>Remove</button>
              </div>
            </div>
          ))}
          {room.gallery.length < 10 && (
            <button type="button" className="room-wizard-upload-tile" onClick={() => galleryInput.current?.click()}>
              <span>＋</span><strong>Upload Photos</strong><small>PNG, JPG, WebP · up to 10 MB</small>
            </button>
          )}
        </div>
        <input ref={galleryInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => receiveFiles(event, "gallery")} />
        {photoError && <p className="room-wizard-error" role="alert">{photoError}</p>}
      </section>
    </div>
  );
}

function Amenities({ room, update }: { room: RoomTypeEntry; update: (values: Partial<RoomTypeEntry>) => void }) {
  const [search, setSearch] = useState("");

  function toggle(item: string) {
    update({ amenities: room.amenities.includes(item) ? room.amenities.filter((value) => value !== item) : [...room.amenities, item] });
  }

  function toggleGroup(items: string[]) {
    const allSelected = items.every((item) => room.amenities.includes(item));
    update({ amenities: allSelected ? room.amenities.filter((item) => !items.includes(item)) : [...new Set([...room.amenities, ...items])] });
  }

  return (
    <section className="room-wizard-section room-wizard-amenities">
      <div className="room-wizard-section-head">
        <div className="room-wizard-section-title-inline"><h2>Amenities Selection</h2><span className="room-wizard-count">{room.amenities.length} amenities selected</span></div>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search amenities..." aria-label="Cari fasilitas" />
      </div>
      {amenityGroups.map((group) => {
        const visible = group.items.filter((item) => item.toLowerCase().includes(search.toLowerCase()));
        if (!visible.length) return null;
        return (
          <div className="room-wizard-amenity-group" key={group.title}>
            <div className="room-wizard-section-head"><h3>{group.title}</h3><button type="button" onClick={() => toggleGroup(visible)}>Select All</button></div>
            <div className="room-wizard-amenity-grid">
              {visible.map((item) => <label key={item}><input type="checkbox" checked={room.amenities.includes(item)} onChange={() => toggle(item)} />{item}</label>)}
            </div>
          </div>
        );
      })}
      {search && !amenityGroups.some((group) => group.items.some((item) => item.toLowerCase().includes(search.toLowerCase()))) && <p className="room-wizard-muted">Tidak ada fasilitas yang cocok.</p>}
    </section>
  );
}

function Capacity({ room, update, backToBasic }: { room: RoomTypeEntry; update: (values: Partial<RoomTypeEntry>) => void; backToBasic: () => void }) {
  const selectedCount = room.capacityPatterns.filter((pattern) => pattern.selected).length;

  function updatePattern(index: number, values: Partial<CapacityPattern>) {
    update({ capacityPatterns: room.capacityPatterns.map((pattern, current) => current === index ? { ...pattern, ...values } : pattern) });
  }

  return (
    <div className="room-wizard-sections">
      <section className="room-wizard-section">
        <div className="room-wizard-extra-summary">
          <div><strong>Extra Bed Configuration</strong><small>Maximum Extra Beds: {room.extraBedEnabled ? room.maxExtraBeds : 0} · Configured in Step 1: Basic Info</small></div>
          <button type="button" onClick={backToBasic}>Step 1: Basic Info</button>
        </div>
      </section>
      <section className="room-wizard-section">
        <h2>Capacity Patterns</h2>
        <p>Pilih semua kombinasi tamu yang diperbolehkan untuk tipe kamar ini.</p>
        <div className="room-wizard-info">Pilih semua pola kapasitas yang valid, bukan hanya kapasitas maksimum. Setiap pola menentukan izin reservasi dan alokasi kasur tambahan.</div>
        <div className="room-wizard-capacity-head"><strong>Kombinasi Okupansi Tamu</strong><span>{selectedCount} Dipilih</span><button type="button" onClick={() => update({ capacityPatterns: room.capacityPatterns.map((pattern) => ({ ...pattern, selected: selectedCount !== room.capacityPatterns.length })) })}>Select All</button></div>
        <div className="room-wizard-capacity-scroll">
          <table className="room-wizard-capacity-table">
            <thead><tr><th>SELECT</th><th>NUMBER OF PERSONS / GUEST COMBINATION</th><th>EXTRA BED</th></tr></thead>
            <tbody>
              {room.capacityPatterns.map((pattern, index) => (
                <tr key={`${pattern.adults}-${pattern.children}`} className={pattern.selected ? "is-selected" : ""}>
                  <td><input type="checkbox" checked={pattern.selected} onChange={(event) => updatePattern(index, { selected: event.target.checked })} aria-label={`Pilih ${pattern.adults} dewasa ${pattern.children} anak`} /></td>
                  <td><strong>{pattern.adults} {pattern.adults === 1 ? "Adult" : "Adults"} + {pattern.children} {pattern.children === 1 ? "Child" : "Children"}</strong><small>({pattern.adults + pattern.children} Orang)</small></td>
                  <td>
                    <select value={Math.min(pattern.extraBeds, room.extraBedEnabled ? room.maxExtraBeds : 0)} onChange={(event) => updatePattern(index, { extraBeds: Number(event.target.value) })} disabled={!pattern.selected || !room.extraBedEnabled} aria-label={`Extra bed untuk ${pattern.adults} dewasa ${pattern.children} anak`}>
                      {Array.from({ length: room.extraBedEnabled ? room.maxExtraBeds + 1 : 1 }, (_, count) => <option value={count} key={count}>{count} Extra Bed</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="room-wizard-capacity-note">Engine reservasi hanya akan menampilkan kamar ini tersedia apabila kombinasi tamu yang dicari cocok dengan pola yang dicentang di atas.</p>
      </section>
    </div>
  );
}

export function AddRoomTypePage({ roomId }: { roomId?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [highestStep, setHighestStep] = useState(0);
  const [room, setRoom] = useState<RoomTypeEntry>(initialRoom);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(!roomId);
  const [missing, setMissing] = useState(false);
  const title = roomId ? "Edit Room Type" : "Add Room Type";

  useEffect(() => {
    if (!roomId) return;
    const existing = getRoomTypeById(roomId);
    if (existing) {
      setRoom({
        ...existing,
        cover: existing.cover ? { ...existing.cover } : null,
        gallery: existing.gallery.map((photo) => ({ ...photo })),
        amenities: [...existing.amenities],
        capacityPatterns: existing.capacityPatterns.map((pattern) => ({ ...pattern })),
      });
      setMissing(false);
    } else {
      setMissing(true);
    }
    setStep(0);
    setHighestStep(0);
    setLoaded(true);
  }, [roomId]);

  function update(values: Partial<RoomTypeEntry>) {
    setRoom((current) => ({ ...current, ...values }));
    setError("");
  }

  function validateBasic() {
    if (!room.name.trim()) return "Room Type Name wajib diisi.";
    if (!Number.isFinite(room.size) || room.size < 1) return "Room Size harus lebih dari 0.";
    if (!Number.isInteger(room.bedCount) || room.bedCount < 1) return "Number of Beds harus minimal 1.";
    if (room.extraBedEnabled && (!Number.isInteger(room.maxExtraBeds) || room.maxExtraBeds < 1 || room.extraBedPrice < 0)) return "Periksa konfigurasi Extra Bed.";
    if (room.adultBreakfastPrice < 0 || room.childBreakfastPrice < 0) return "Harga sarapan tidak boleh negatif.";
    return "";
  }

  function next() {
    if (step === 0) {
      const message = validateBasic();
      if (message) { setError(message); return; }
    }
    setError("");
    setHighestStep((current) => Math.max(current, step + 1));
    setStep((current) => current + 1);
  }

  function save() {
    const basicError = validateBasic();
    if (basicError) {
      setStep(0);
      setError(basicError);
      return;
    }
    if (!room.capacityPatterns.some((pattern) => pattern.selected)) {
      setError("Pilih minimal satu pola kapasitas tamu.");
      return;
    }
    const entry = { ...room, name: room.name.trim() };
    if (roomId) {
      if (!updateRoomType(entry)) {
        setError("Tipe kamar tidak ditemukan.");
        return;
      }
    } else {
      addRoomType({ ...entry, id: `room-${crypto.randomUUID()}` });
    }
    router.push("/rooms");
  }

  if (!loaded) {
    return <AdminShell title="Rooms" context={title}><div className="room-wizard-page">Memuat tipe kamar...</div></AdminShell>;
  }

  if (missing) {
    return <AdminShell title="Rooms" context={title}><div className="room-wizard-page"><h1>Tipe kamar tidak ditemukan</h1><Link href="/rooms">← Room Types</Link></div></AdminShell>;
  }

  return (
    <AdminShell title="Rooms" context={title}>
      <div className="room-wizard-page">
        <div className="room-types-breadcrumb"><Link href="/rooms">Rooms</Link> / <Link href="/rooms">Room Types</Link> / {title}</div>
        <div className="room-wizard-heading"><h1>{title}</h1><p>{roomId ? `Perbarui ${room.name} · ${descriptions[step].toLowerCase()}` : descriptions[step]}</p></div>
        <nav className="room-wizard-steps" aria-label="Add Room Type steps">
          {steps.map((name, index) => (
            <button type="button" key={name} className={index === step ? "is-current" : index < step ? "is-complete" : ""} onClick={() => { if (index <= highestStep) { setStep(index); setError(""); } }} disabled={index > highestStep} aria-current={index === step ? "step" : undefined}>
              <span>{index < step ? "✓" : index + 1}</span><strong>{name}</strong><small>{index === step ? "In Progress" : index < step ? "Completed" : "Pending"}</small>
            </button>
          ))}
        </nav>

        <div className="room-wizard-content">
          {step === 0 && <BasicInfo room={room} update={update} />}
          {step === 1 && <Photos room={room} update={update} />}
          {step === 2 && <Amenities room={room} update={update} />}
          {step === 3 && <Capacity room={room} update={update} backToBasic={() => setStep(0)} />}
        </div>
        {error && <p className="room-wizard-error" role="alert">{error}</p>}
        <div className="room-wizard-footer">
          {step === 0 ? <Link href="/rooms" className="room-wizard-secondary">Cancel</Link> : <button type="button" className="room-wizard-secondary" onClick={() => { setStep((current) => current - 1); setError(""); }}>← Previous: {steps[step - 1]}</button>}
          {step < 3 ? <button type="button" className="action-button" onClick={next}>Next: {steps[step + 1]} →</button> : <button type="button" className="action-button" onClick={save}>◉ {roomId ? "Save Changes" : "Save Room Type"}</button>}
        </div>
      </div>
    </AdminShell>
  );
}

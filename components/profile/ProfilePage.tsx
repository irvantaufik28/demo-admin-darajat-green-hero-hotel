"use client";

import Link from "next/link";
import { useEffect, useState, type ChangeEvent } from "react";
import { AdminShell } from "../layout/AdminShell";
import { initialUsers } from "../../lib/users-data";

const owner = initialUsers[0];

export function ProfilePage() {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      setPhotoError("Pilih gambar JPG, PNG, atau WebP maksimal 2 MB.");
      event.target.value = "";
      return;
    }
    setPhotoUrl(URL.createObjectURL(file));
    setPhotoError("");
    event.target.value = "";
  }

  return (
    <AdminShell title="Account" context="Profile">
      <main className="account-page">
        <header>
          <h1>Jhon Doe</h1>
          <p>Informasi akun pemilik Green Hero Darajat.</p>
        </header>

        <section className="account-panel">
          <div className="account-owner-header">
            <div className="account-owner-photo">
              {photoUrl ? <img src={photoUrl} alt="Foto profil Owner" /> : <span aria-hidden="true">JD</span>}
            </div>
            <div className="account-owner-identity">
              <h2>{owner.name}</h2>
              <span>Owner · Green Hero Darajat</span>
              <div className="account-photo-actions">
                <input id="owner-photo-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} />
                <label htmlFor="owner-photo-upload">Upload Photo</label>
                {photoUrl && <button type="button" onClick={() => setPhotoUrl(null)}>Remove</button>}
              </div>
              <small>JPG, PNG, atau WebP · maks. 2 MB. Foto hanya tampil selama halaman ini dibuka.</small>
              {photoError && <small className="account-photo-error" role="alert">{photoError}</small>}
            </div>
          </div>
        </section>

        <section className="account-panel">
          <div className="account-panel__heading"><h2>Personal Information</h2></div>
          <dl className="account-details">
            <div><dt>Full Name</dt><dd>{owner.name}</dd></div>
            <div><dt>Role</dt><dd>{owner.role}</dd></div>
            <div><dt>Email</dt><dd>{owner.email}</dd></div>
            <div><dt>Phone</dt><dd>{owner.phone}</dd></div>
            <div><dt>Property</dt><dd>Green Hero Darajat</dd></div>
            <div><dt>Location</dt><dd>Darajat Pass, Garut, Jawa Barat</dd></div>
          </dl>
        </section>

        <section className="account-panel">
          <div className="account-panel__heading"><h2>Account & Access</h2></div>
          <dl className="account-details">
            <div><dt>Username</dt><dd>admin.darajat</dd></div>
            <div><dt>Status</dt><dd><span className="users-status users-status--active">{owner.status}</span></dd></div>
            <div><dt>Last Login</dt><dd>{owner.lastLogin}</dd></div>
            <div><dt>Access</dt><dd>Owner permissions</dd></div>
          </dl>
          <div className="account-profile-footer">
            <Link href="/change-password">Change Password →</Link>
          </div>
        </section>
      </main>
    </AdminShell>
  );
}

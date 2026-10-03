export type AdminUser = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: "Active" | "Inactive";
  lastLogin: string;
};

export const initialUsers: AdminUser[] = [
  { id: 1, name: "Jhon Doe", email: "owner@greenhero.id", phone: "+62 812 1000 1001", role: "Owner", status: "Active", lastLogin: "2 Oct 2026, 09:42" },
  { id: 2, name: "Nadia Prameswari", email: "nadia@greenhero.id", phone: "+62 812 1000 1002", role: "Manager", status: "Active", lastLogin: "2 Oct 2026, 08:15" },
  { id: 3, name: "Rizky Maulana", email: "rizky@greenhero.id", phone: "+62 812 1000 1003", role: "Admin", status: "Active", lastLogin: "1 Oct 2026, 17:34" },
  { id: 4, name: "Siti Rahmawati", email: "siti@greenhero.id", phone: "+62 812 1000 1004", role: "Front Office", status: "Active", lastLogin: "2 Oct 2026, 07:05" },
  { id: 5, name: "Deni Kurniawan", email: "deni@greenhero.id", phone: "+62 812 1000 1005", role: "Staff", status: "Inactive", lastLogin: "29 Sep 2026, 14:20" },
];

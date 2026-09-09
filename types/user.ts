export type UserRole = "student" | "parent" | "admin";
export type UserStatus = "pending" | "approved" | "rejected";

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  studentName?: string;
  status: UserStatus;
  createdAt: string; // ISO date string
  approvedAt?: string;
  approvedBy?: string;
}

export interface WhitelistItem {
  id?: string;
  email: string;
  fullName?: string;
  role?: UserRole;
  createdAt?: string;
}

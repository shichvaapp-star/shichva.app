import AdminDashboard from "@/components/admin/AdminDashboard";

export default function RootAdminPage() {
  const classId = process.env.NEXT_PUBLIC_CLASS_ID || "kita2";
  return <AdminDashboard classId={classId} />;
}

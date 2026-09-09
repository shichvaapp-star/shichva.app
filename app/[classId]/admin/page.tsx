import AdminDashboard from "@/components/admin/AdminDashboard";

interface Props {
  params: Promise<{ classId: string }>;
}

export default async function DynamicAdminPage({ params }: Props) {
  const { classId } = await params;
  return <AdminDashboard classId={classId} />;
}

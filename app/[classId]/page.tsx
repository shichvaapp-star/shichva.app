import ClassHome from "@/components/class/ClassHome";

interface Props {
  params: Promise<{ classId: string }>;
}

export default async function DynamicClassPage({ params }: Props) {
  const { classId } = await params;
  return <ClassHome classId={classId} />;
}

import ClassHome from "@/components/class/ClassHome";

export default function RootHomePage() {
  const classId = process.env.NEXT_PUBLIC_CLASS_ID || "kita2";
  return <ClassHome classId={classId} />;
}

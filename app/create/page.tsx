import CreateClassWizard from "@/components/onboarding/CreateClassWizard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "הקמת אתר כיתה חדש תוך דקה | שכבה",
  description: "פלטפורמת אתרי כיתה חכמים ומאובטחים — צור אתר כיתה ייחודי למחנכים, הורים ותלמידים",
};

export default function CreateClassPage() {
  return <CreateClassWizard />;
}

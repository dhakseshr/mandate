import { ForensicsView } from "@/components/forensics/forensics-view";

export const metadata = { title: "Forensics · Writ" };

export default async function ForensicsPage({ params }: { params: Promise<{ purchaseId: string }> }) {
  return <ForensicsView purchaseId={(await params).purchaseId} />;
}

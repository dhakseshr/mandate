import { MandateScreen } from "@/components/mandate-screen";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <MandateScreen id={(await params).id} />;
}

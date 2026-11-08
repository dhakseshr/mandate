import { PassportView } from "@/components/passport/passport-view";

export const metadata = { title: "Agent passport · Writ" };

export default async function AgentPassportPage({ params }: { params: Promise<{ id: string }> }) {
  return <PassportView id={(await params).id} />;
}

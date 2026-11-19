import type { Metadata } from "next";
import { Pending } from "@/components/Pending";
import { messages } from "@/lib/messages.en";

export const metadata: Metadata = { title: messages.views.costs.title };

export default function CostsPage() {
  return <Pending view="costs" />;
}

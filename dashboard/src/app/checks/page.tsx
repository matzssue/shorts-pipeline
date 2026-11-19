import type { Metadata } from "next";
import { Pending } from "@/components/Pending";
import { messages } from "@/lib/messages.en";

export const metadata: Metadata = { title: messages.views.checks.title };

export default function ChecksPage() {
  return <Pending view="checks" />;
}

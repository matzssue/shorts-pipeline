import type { Metadata } from "next";
import { ChecksView } from "@/components/checks/ChecksView";
import { getData } from "@/data";
import { checksPage } from "@/data/selectors/checks";
import { messages } from "@/lib/messages.en";

export const metadata: Metadata = { title: messages.views.checks.title };

export default function ChecksPage() {
  return <ChecksView d={checksPage(getData().films)} />;
}

import type { Metadata } from "next";
import { Pending } from "@/components/Pending";
import { messages } from "@/lib/messages.en";

export const metadata: Metadata = { title: messages.views.about.title };

export default function AboutPage() {
  return <Pending view="about" />;
}

import type { Metadata } from "next";
import { Pending } from "@/components/Pending";
import { messages } from "@/lib/messages.en";

export const metadata: Metadata = { title: messages.views.films.title };

export default function FilmsPage() {
  return <Pending view="films" />;
}

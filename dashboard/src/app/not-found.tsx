import Link from "next/link";
import { messages } from "@/lib/messages.en";

export default function NotFound() {
  return (
    <section className="page">
      <div className="sec">
        <h1 className="mb-2 text-lg leading-[1.2] font-bold [font-stretch:88%]">{messages.notFound.title}</h1>
        <p className="text-ink-2">{messages.notFound.body}</p>
        <Link href="/" className="mt-3 inline-block text-sm font-semibold [font-stretch:88%]">
          {messages.notFound.back} →
        </Link>
      </div>
    </section>
  );
}

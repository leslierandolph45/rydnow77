// app/book/[reference]/page.tsx
import type { Metadata } from "next";
import TrackBooking from "@/app/components/booking/TrackBooking";

export const metadata: Metadata = { title: "Your booking | RYDNOW" };

export default async function TrackPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return <TrackBooking reference={reference} />;
}



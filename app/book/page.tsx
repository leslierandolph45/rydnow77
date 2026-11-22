// app/book/page.tsx
// Customer "create a booking" page. All logic (service, addresses, signed quote, payment,
// confirmation) lives in components/booking/BookingFlow.tsx. This file only mounts it.
//
// BookingFlow redirects to /book/<reference> after a successful booking, so the tracking page
// belongs at app/book/[reference]/page.tsx.
import type { Metadata } from "next";
import BookingFlow from "../components/booking/BookingFlow";

export const metadata: Metadata = {
  title: "Book a trip | RYDNOW",
  description: "Book an okada ride, parcel delivery or waste pickup. See your full price before you confirm.",
  robots: { index: false, follow: false }, // booking is a signed-in screen
};

export default function BookPage() {
  return <BookingFlow />;
}


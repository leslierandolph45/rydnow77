'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

// ─── BRAND COLORS ──────────────────────────────────────────────
const BRAND = {
  navy: '#0A2342',
  blue: '#0F52BA',
  gold: '#F2A900',
  goldDark: '#D4880E',
} as const;

export default function ReviewsPage() {
  const [name, setName] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    alert('Thank you for your review! ✅');
    setSubmitted(true);
    setName('');
    setRating(5);
    setComment('');
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Header */}
      <header className="px-4 py-4 flex items-center justify-between border-b border-gray-100 max-w-md mx-auto">
        <Link href="/" className="font-extrabold text-xl" style={{ color: BRAND.blue }}>RYDNOW</Link>
        <Link href="/" className="text-sm text-gray-600">← Back Home</Link>
      </header>

      {/* Main Content */}
      <main className="px-4 py-8 max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-center mb-2" style={{ color: BRAND.navy }}>Leave a Review</h1>
        <p className="text-center text-gray-500 mb-8">How did we do?</p>

        {submitted && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 text-center">
            ✅ Thank you! Your review has been received.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BRAND.navy }}>Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              placeholder="Your full name"
            />
          </div>

          {/* Star Rating */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BRAND.navy }}>Your Rating</label>
            <div className="flex gap-2 justify-center py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="text-3xl transition-transform hover:scale-110"
                  style={{ color: star <= rating ? BRAND.gold : '#D1D5DB' }}
                >
                  ★
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-gray-500 mt-1">{rating} out of 5 stars</p>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: BRAND.navy }}>Your Review</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              rows={4}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              placeholder="Tell us about your experience..."
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3 rounded-lg font-semibold text-white text-sm hover:opacity-90 transition-colors"
            style={{ backgroundColor: BRAND.blue }}
          >
            Submit Review
          </button>
        </form>
      </main>
    </div>
  );
}

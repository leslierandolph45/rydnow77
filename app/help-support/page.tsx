'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const faqs = [
  { q: 'How do I book a ride?', a: 'Enter your pickup and destination, choose your service type, then confirm payment. We\'ll search for a rider and connect you instantly.' },
  { q: 'How do I pay?', a: 'We accept Mobile Money (MTN, Telecel, AT Money) and Visa/Debit cards. You can save your preferred methods in Payment Methods.' },
  { q: 'What if I need to cancel?', a: 'You can cancel while a rider is being searched. Once a rider is assigned, please message them directly or call to discuss changes.' },
  { q: 'My rider didn\'t show up', a: 'Go to your active booking and tap "Report Issue". We\'ll investigate and help find another rider.' },
  { q: 'How do I change my phone number?', a: 'Go to Account → Contact Number → Change. Your new number will be updated immediately.' },
];

export default function HelpSupportPage() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
    setFormData({ name: '', email: '', message: '' });
  };

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col">
      <header className="w-full bg-blue-900 px-5 py-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-white text-lg">←</button>
        <h1 className="text-lg font-bold text-white">Help & Support</h1>
        <div className="w-6"></div>
      </header>

      <main className="flex-1 px-4 py-6">
        {/* Contact Cards */}
        <div className="space-y-3 mb-8">
          <a href="tel:+233594116155" className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
            <span className="text-2xl">📞</span>
            <div>
              <p className="text-sm font-bold text-gray-800">Call Us</p>
              <p className="text-xs text-gray-500">Mon - Fri, 8am - 6pm</p>
            </div>
          </a>
          <a href="mailto:support@rydnow.app" className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
            <span className="text-2xl">✉️</span>
            <div>
              <p className="text-sm font-bold text-gray-800">Email Support</p>
              <p className="text-xs text-gray-500">support@rydnow.app</p>
            </div>
          </a>
          <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
            <span className="text-2xl">💬</span>
            <div>
              <p className="text-sm font-bold text-gray-800">Live Chat</p>
              <p className="text-xs text-green-600">● Available now</p>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <h3 className="text-sm font-bold text-gray-800 mb-4">Frequently Asked Questions</h3>
        <div className="space-y-2 mb-8">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full p-4 text-left flex items-center justify-between"
              >
                <span className="text-sm font-medium pr-2">{faq.q}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {openFaq === i ? '−' : '+'}
                </span>
              </button>
              {openFaq === i && (
                <p className="px-4 pb-4 text-sm text-gray-500 border-t pt-3">{faq.a}</p>
              )}
            </div>
          ))}
        </div>

        {/* Message Form */}
        <h3 className="text-sm font-bold text-gray-800 mb-4">Send us a message</h3>
        {submitted ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-green-700 font-medium">✅ Message sent!</p>
            <p className="text-sm text-green-600 mt-1">We'll get back to you soon.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 bg-white p-4 rounded-xl border border-gray-200">
            <input
              type="text"
              placeholder="Your Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full p-3 border border-gray-200 rounded-lg text-sm"
            />
            <input
              type="email"
              placeholder="Your Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full p-3 border border-gray-200 rounded-lg text-sm"
            />
            <textarea
              placeholder="How can we help?"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              required
              rows={4}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-blue-900 text-white font-bold text-sm"
            >
              Send Message
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentMethodsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('account');
  const [savedNumbers, setSavedNumbers] = useState<string[]>([]);
  const [activeNumber, setActiveNumber] = useState<string | null>(null);
  const [newNumber, setNewNumber] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [notification, setNotification] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('momo_numbers');
      if (saved) setSavedNumbers(JSON.parse(saved));
      const active = localStorage.getItem('momo_active');
      if (active) setActiveNumber(active);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('momo_numbers', JSON.stringify(savedNumbers));
  }, [savedNumbers]);

  useEffect(() => {
    if (activeNumber) localStorage.setItem('momo_active', activeNumber);
  }, [activeNumber]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  const addNumber = () => {
    if (newNumber.length < 8) {
      showNotification('⚠️ Enter a valid number');
      return;
    }
    if (savedNumbers.includes(newNumber)) {
      showNotification('⚠️ Number already added');
      return;
    }
    setSavedNumbers(prev => [...prev, newNumber]);
    if (!activeNumber) setActiveNumber(newNumber);
    setNewNumber('');
    setIsAdding(false);
    showNotification('✅ Number added!');
  };

  const removeNumber = (num: string) => {
    setSavedNumbers(prev => prev.filter(n => n !== num));
    if (activeNumber === num) setActiveNumber(savedNumbers.find(n => n !== num) || null);
    showNotification('✅ Removed');
  };

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col">
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-blue-900 text-white px-5 py-3 rounded-xl text-sm font-medium">
          {notification}
        </div>
      )}

      <header className="w-full bg-blue-900 px-5 py-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-white text-lg">←</button>
        <h1 className="text-lg font-bold text-white">Payment Methods</h1>
        <div className="w-6"></div>
      </header>

      <main className="flex-1 px-4 py-6">
        {/* Mobile Money Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h3 className="text-sm font-bold text-gray-800 mb-4">📱 Mobile Money</h3>

          {savedNumbers.length === 0 ? (
            <p className="text-sm text-gray-500 mb-4">No payment methods added yet</p>
          ) : (
            <div className="space-y-3 mb-4">
              {savedNumbers.map(num => (
                <div key={num} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveNumber(num)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        activeNumber === num ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}
                    >
                      {activeNumber === num && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
                    </button>
                    <span className="text-sm font-medium">{num}</span>
                  </div>
                  <button onClick={() => removeNumber(num)} className="text-red-500 text-xs">Remove</button>
                </div>
              ))}
            </div>
          )}

          {!isAdding ? (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600"
            >
              + Add New Number
            </button>
          ) : (
            <div className="space-y-3">
              <input
                type="tel"
                placeholder="Enter Mobile Money Number"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={addNumber}
                  className="flex-1 py-2 rounded-lg bg-blue-900 text-white text-sm font-bold"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Card Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-4">💳 Saved Cards</h3>
          <p className="text-sm text-gray-500 mb-4">No cards saved</p>
          <p className="text-xs text-gray-400">Cards are securely processed at checkout</p>
        </div>
      </main>

      <nav className="w-full bg-white border-t border-gray-100 px-8 py-4">
        <div className="flex justify-between items-center">
          <button onClick={() => router.push('/')} className="flex flex-col items-center gap-1 text-gray-400">
            <span className="text-lg">🏠</span><span className="text-xs">Home</span>
          </button>
          <button onClick={() => router.push('/activity')} className="flex flex-col items-center gap-1 text-gray-400">
            <span className="text-lg">📋</span><span className="text-xs">Activity</span>
          </button>
          <button onClick={() => router.push('/account')} className="flex flex-col items-center gap-1 text-blue-900 font-bold">
            <span className="text-lg">👤</span><span className="text-xs">Account</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

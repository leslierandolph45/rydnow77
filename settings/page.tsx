'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState(true);
  const [rideUpdates, setRideUpdates] = useState(true);
  const [promotions, setPromotions] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [currency, setCurrency] = useState('GH₵');
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rydnow_settings');
      if (saved) {
        const s = JSON.parse(saved);
        setNotifications(s.notifications ?? true);
        setRideUpdates(s.rideUpdates ?? true);
        setPromotions(s.promotions ?? false);
        setCurrency(s.currency ?? 'GH₵');
        setDistanceUnit(s.distanceUnit ?? 'km');
      }
    }
  }, []);

  

  useEffect(() => {
    localStorage.setItem('rydnow_settings', JSON.stringify({
      notifications, rideUpdates, promotions, currency, distanceUnit
    }));
  }, [notifications, rideUpdates, promotions, currency, distanceUnit]);

  const clearCache = () => {
    localStorage.removeItem('momo_numbers');
    localStorage.removeItem('rydnow_settings');
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  };

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col">
      <header className="w-full bg-blue-900 px-5 py-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-white text-lg">←</button>
        <h1 className="text-lg font-bold text-white">Settings</h1>
        <div className="w-6"></div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        {/* Notifications */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-4">🔔 Notifications</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Push Notifications</span>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`w-12 h-7 rounded-full transition-colors ${
                  notifications ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mt-1 ${
                  notifications ? 'ml-6' : 'ml-1'
                }`}></div>
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Ride Status Updates</span>
              <button
                onClick={() => setRideUpdates(!rideUpdates)}
                className={`w-12 h-7 rounded-full transition-colors ${
                  rideUpdates ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mt-1 ${
                  rideUpdates ? 'ml-6' : 'ml-1'
                }`}></div>
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Promotions & Offers</span>
              <button
                onClick={() => setPromotions(!promotions)}
                className={`w-12 h-7 rounded-full transition-colors ${
                  promotions ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mt-1 ${
                  promotions ? 'ml-6' : 'ml-1'
                }`}></div>
              </button>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-4">⚙️ Preferences</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="GH₵">Ghana Cedi — GH₵</option>
                <option value="$">US Dollar — $</option>
                <option value="£">British Pound — £</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Distance Unit</label>
              <select
                value={distanceUnit}
                onChange={(e) => setDistanceUnit(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="km">Kilometers (km)</option>
                <option value="mi">Miles (mi)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-4">📦 App Data</h3>
          <button
            onClick={clearCache}
            className="w-full py-3 border border-red-200 text-red-600 rounded-lg text-sm font-medium"
          >
            🗑️ Clear Local Cache
          </button>
          {cleared && (
            <p className="text-xs text-green-600 mt-2 text-center">✅ Cache cleared</p>
          )}
          <p className="text-xs text-gray-400 mt-2 text-center">
            This only clears saved payment method prefs — your bookings stay safe
          </p>
        </div>

        {/* Legal */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3">📋 Legal</h3>
          <div className="space-y-3">
            <button className="w-full text-left text-sm text-blue-600">Terms of Service</button>
            <button className="w-full text-left text-sm text-blue-600">Privacy Policy</button>
            <p className="text-xs text-gray-400 pt-2">Version 1.0.0</p>
          </div>
        </div>
      </main>
    </div>
  );
}

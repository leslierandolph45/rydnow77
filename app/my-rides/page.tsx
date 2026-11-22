'use client';


import { useState, useEffect } from 'react';


type Booking = {
  id: string;
  pickup: string;
  destination: string;
  date: string;
  time: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  price?: string;
  riderName?: string;
  riderPhone?: string;
};


export default function MyRidesPage() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);


  useEffect(() => {
    const saved = localStorage.getItem('rydnow_bookings');
    if (saved) {
      setBookings(JSON.parse(saved));
    }
  }, []);


  const upcomingBookings = bookings.filter(
    b => b.status === 'upcoming' || b.status === 'ongoing'
  );
  const pastBookings = bookings.filter(
    b => b.status === 'completed' || b.status === 'cancelled'
  );


  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-50 text-blue-700';
      case 'ongoing': return 'bg-green-50 text-green-700';
      case 'completed': return 'bg-gray-50 text-gray-600';
      case 'cancelled': return 'bg-red-50 text-red-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };


  const cancelBooking = (id: string) => {
    if (confirm('Are you sure you want to cancel this booking?')) {
      const updated = bookings.map(b => 
        b.id === id ? { ...b, status: 'cancelled' as const } : b
      );
      setBookings(updated);
      localStorage.setItem('rydnow_bookings', JSON.stringify(updated));
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => window.history.back()} className="text-gray-600 text-sm">
            ← Back
          </button>
          <h1 className="text-lg font-bold text-gray-900">My Rides</h1>
          <div className="w-6"></div>
        </div>
      </header>


      {/* Tabs */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'upcoming'
                ? 'bg-white shadow-sm text-gray-900 font-semibold'
                : 'text-gray-500'
            }`}
          >
            Upcoming ({upcomingBookings.length})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'past'
                ? 'bg-white shadow-sm text-gray-900 font-semibold'
                : 'text-gray-500'
            }`}
          >
            History ({pastBookings.length})
          </button>
        </div>


        {/* Upcoming Rides */}
        {activeTab === 'upcoming' && (
          <div className="space-y-4">
            {upcomingBookings.length === 0 ? (
              <div className="text-center py-16">
                {/* Your Custom Icon */}
                <img 
                  src="/motorcycle-delivery.png" 
                  alt="No rides yet" 
                  className="w-20 h-20 mx-auto mb-4 object-contain"
                />
                <h3 className="text-sm font-medium text-gray-900 mt-4">No Upcoming Rides</h3>
                <p className="text-xs text-gray-400 mt-1">Book a ride and it will appear here</p>
                <button
                  onClick={() => window.location.href = '/book-ride'}
                  className="mt-5 bg-black text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  Book a Ride
                </button>
              </div>
            ) : (
              upcomingBookings.map(booking => (
                <div key={booking.id} className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-xs text-gray-400">{booking.date} at {booking.time}</p>
                      <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(booking.status)}`}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </span>
                    </div>
                    {booking.status === 'upcoming' && (
                      <button
                        onClick={() => cancelBooking(booking.id)}
                        className="text-red-500 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                        <div className="w-0.5 h-6 bg-gray-200 my-1"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-gray-400">PICKUP</p>
                          <p className="text-sm font-medium">{booking.pickup}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">DESTINATION</p>
                          <p className="text-sm font-medium">{booking.destination}</p>
                        </div>
                      </div>
                    </div>
                    
                    {booking.riderName && (
                      <div className="border-t border-gray-100 pt-3 mt-3">
                        <p className="text-xs text-gray-400">YOUR RIDER</p>
                        <p className="text-sm font-medium">{booking.riderName}</p>
                        <p className="text-xs text-gray-500">{booking.riderPhone}</p>
                      </div>
                    )}
                    
                    {booking.price && (
                      <div className="border-t border-gray-100 pt-3 mt-3 flex justify-between items-center">
                        <span className="text-sm text-gray-500">Estimated Fare</span>
                        <span className="text-sm font-bold text-gray-900">GH₵ {booking.price}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}


        {/* Past Rides */}
        {activeTab === 'past' && (
          <div className="space-y-4">
            {pastBookings.length === 0 ? (
              <div className="text-center py-16">
                {/* Your Custom Icon for History too */}
                <img 
                  src="/motorcycle-delivery.png" 
                  alt="No ride history" 
                  className="w-20 h-20 mx-auto mb-4 object-contain opacity-60"
                />
                <h3 className="text-sm font-medium text-gray-900 mt-4">No Ride History Yet</h3>
                <p className="text-xs text-gray-400 mt-1">Your completed rides will show here</p>
              </div>
            ) : (
              pastBookings.map(booking => (
                <div key={booking.id} className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-xs text-gray-400">{booking.date} at {booking.time}</p>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(booking.status)}`}>
                      {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{booking.pickup} → {booking.destination}</p>
                    {booking.price && (
                      <p className="text-sm font-bold text-gray-900">GH₵ {booking.price}</p>
                    )}
                  </div>
                  
                  <button className="mt-3 text-sm text-black font-medium underline">
                    View Receipt
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

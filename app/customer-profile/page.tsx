'use client';


import { useState, useEffect } from 'react';


type PaymentMethod = {
  id: string;
  type: 'card' | 'mobile_money';
  label: string;
  details: string;
  isDefault: boolean;
};


export default function CustomerProfile() {
  const [activeTab, setActiveTab] = useState<'profile' | 'payments' | 'settings'>('profile');
  
  // User data
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Payments
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentType, setPaymentType] = useState<'card' | 'mobile_money'>('mobile_money');
  
  // NEW: Payment input fields
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState('');
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState('MTN');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardName, setCardName] = useState('');
  
  // Settings
  const [notificationPrefs, setNotificationPrefs] = useState({
    rideUpdates: true,
    promotions: false,
    emailReceipts: true,
  });


  // Load saved data
  useEffect(() => {
    try {
      const userStr = localStorage.getItem('rydnow_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setFullName(user.name || '');
        setEmail(user.email || '');
        setPhone(user.phone || '');
        if (user.profilePic) setProfilePic(user.profilePic);
      }
      const savedPayments = localStorage.getItem('rydnow_payments');
      if (savedPayments) setPaymentMethods(JSON.parse(savedPayments));
      const savedPrefs = localStorage.getItem('rydnow_notifications');
      if (savedPrefs) setNotificationPrefs(JSON.parse(savedPrefs));
    } catch (e) {
      console.log('Loading data');
    }
  }, []);


  // Save profile changes
  const saveChanges = () => {
    const user = JSON.parse(localStorage.getItem('rydnow_user') || '{}');
    const updated = { ...user, email, phone: newPhone || phone, profilePic };
    localStorage.setItem('rydnow_user', JSON.stringify(updated));
    setPhone(newPhone || phone);
    setNewPhone('');
    setIsEditingPhone(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };


  // Upload profile photo
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result as string);
        const user = JSON.parse(localStorage.getItem('rydnow_user') || '{}');
        localStorage.setItem('rydnow_user', JSON.stringify({ ...user, profilePic: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };


  // ✅ NEW: Add Payment Method with actual details
  const addPaymentMethod = () => {
    let label = '';
    let displayDetails = '';
    let isValid = false;


    if (paymentType === 'mobile_money') {
      if (!mobileMoneyNumber.trim()) {
        alert('Please enter your Mobile Money number');
        return;
      }
      label = `${mobileMoneyProvider} Mobile Money`;
      const last4 = mobileMoneyNumber.slice(-4);
      displayDetails = `•••• ${last4}`;
      isValid = true;
    } else {
      if (!cardNumber.trim() || !cardExpiry.trim() || !cardName.trim()) {
        alert('Please fill in all card details');
        return;
      }
      label = 'Visa • Mastercard';
      const last4 = cardNumber.slice(-4);
      displayDetails = `•••• •••• •••• ${last4}`;
      isValid = true;
    }


    if (isValid) {
      const newMethod: PaymentMethod = {
        id: Date.now().toString(),
        type: paymentType,
        label,
        details: displayDetails,
        isDefault: paymentMethods.length === 0,
      };
      
      const updated = [...paymentMethods, newMethod];
      setPaymentMethods(updated);
      localStorage.setItem('rydnow_payments', JSON.stringify(updated));
      
      // Clear form
      setShowAddPayment(false);
      setMobileMoneyNumber('');
      setCardNumber('');
      setCardExpiry('');
      setCardName('');
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };


  // Delete payment method
  const removePayment = (id: string) => {
    let updated = paymentMethods.filter(p => p.id !== id);
    if (paymentMethods.find(p => p.id === id)?.isDefault && updated.length > 0) {
      updated[0].isDefault = true;
    }
    setPaymentMethods(updated);
    localStorage.setItem('rydnow_payments', JSON.stringify(updated));
  };


  // Set as default
  const setDefaultPayment = (id: string) => {
    const updated = paymentMethods.map(p => ({ ...p, isDefault: p.id === id }));
    setPaymentMethods(updated);
    localStorage.setItem('rydnow_payments', JSON.stringify(updated));
  };


  // Toggle notifications
  const toggleNotification = (key: keyof typeof notificationPrefs) => {
    const updated = { ...notificationPrefs, [key]: !notificationPrefs[key] };
    setNotificationPrefs(updated);
    localStorage.setItem('rydnow_notifications', JSON.stringify(updated));
  };


  // Logout
  const handleLogout = () => {
    localStorage.removeItem('rydnow_user');
    window.location.href = '/login';
  };


  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => window.history.back()} className="text-gray-600 text-sm">← Back</button>
          <h1 className="text-lg font-bold text-gray-900">My Account</h1>
          <div className="w-6"></div>
        </div>
      </header>


      {/* Success Message */}
      {saveSuccess && (
        <div className="fixed top-16 left-4 right-4 max-w-lg mx-auto z-50 bg-green-50 border border-green-200 rounded-lg p-3 shadow-lg">
          <p className="text-green-700 text-sm font-medium text-center">✅ Saved successfully!</p>
        </div>
      )}


      {/* Tabs */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          {[
            { id: 'profile' as const, label: 'Profile' },
            { id: 'payments' as const, label: 'Payments' },
            { id: 'settings' as const, label: 'Settings' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white shadow-sm text-gray-900 font-semibold border-b-2 border-black'
                  : 'text-gray-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>


        {/* ========== PROFILE TAB ========== */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Profile Photo */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="text-base font-semibold mb-4">Profile Picture</h2>
              <div className="flex items-center gap-5">
                <div className="w-24 h-24 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center border-2 border-gray-200">
                  {profilePic ? (
                    <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl text-gray-400">{fullName?.charAt(0)?.toUpperCase() || '👤'}</span>
                  )}
                </div>
                <div>
                  <label className="cursor-pointer inline-block">
                    <span className="bg-black text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                      Choose Photo
                    </span>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                  </label>
                  <p className="text-xs text-gray-400 mt-2">Click to upload a photo</p>
                </div>
              </div>
            </div>


            {/* Personal Info */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-5">
              <h2 className="text-base font-semibold">Personal Information</h2>
              
              {/* Full Name — Read Only */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={fullName}
                    disabled
                    readOnly
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Verified</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Name cannot be changed</p>
              </div>


              {/* Email — Editable */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black"
                />
              </div>


              {/* Phone — Editable */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Phone Number</label>
                
                {!isEditingPhone ? (
                  <div className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium">{phone || 'Not set'}</span>
                    <button onClick={() => setIsEditingPhone(true)} className="text-black text-sm font-semibold underline">
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="Enter new phone number"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black"
                    />
                    <div className="flex gap-3">
                      <button 
                        onClick={() => { setIsEditingPhone(false); setNewPhone(''); }} 
                        className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg font-medium"
                      >
                        Cancel
                      </button>
                      <button onClick={saveChanges} className="flex-1 py-2.5 text-sm bg-black text-white rounded-lg font-medium">
                        Save Number
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>


            <button 
              onClick={saveChanges}
              className="w-full bg-black text-white py-3 rounded-xl font-semibold text-sm hover:bg-gray-800"
            >
              Save All Changes
            </button>
          </div>
        )}


        {/* ========== PAYMENTS TAB ========== */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="text-base font-semibold mb-4">Payment Methods</h2>
              
              {/* Saved Payment Methods List */}
              {paymentMethods.length > 0 ? (
                <div className="space-y-3 mb-6">
                  {paymentMethods.map(method => (
                    <div key={method.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{method.type === 'card' ? '💳' : '📱'}</span>
                        <div>
                          <p className="text-sm font-semibold">{method.label}</p>
                          <p className="text-xs text-gray-400">{method.details}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {method.isDefault ? (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium">Default</span>
                        ) : (
                          <button 
                            onClick={() => setDefaultPayment(method.id)} 
                            className="text-xs text-gray-500 hover:text-black"
                          >
                            Set default
                          </button>
                        )}
                        <button 
                          onClick={() => removePayment(method.id)} 
                          className="text-red-400 hover:text-red-600 text-sm ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 mb-6">
                  <span className="text-4xl">💳</span>
                  <h3 className="text-sm font-medium text-gray-900 mt-3">No payment methods yet</h3>
                  <p className="text-xs text-gray-400 mt-1">Add Mobile Money or a card below</p>
                </div>
              )}


              {/* Add New Payment Button / Form */}
              {!showAddPayment ? (
                <button
                  onClick={() => setShowAddPayment(true)}
                  className="w-full border-2 border-dashed border-gray-300 py-4 rounded-xl text-gray-600 text-sm font-medium hover:border-black hover:bg-gray-50 transition-all"
                >
                  + Add New Payment Method
                </button>
              ) : (
                <div className="border border-gray-200 rounded-xl p-5 space-y-5 mt-4 bg-gray-50/50">
                  <h3 className="text-sm font-semibold">Add Payment Method</h3>
                  
                  {/* Step 1: Choose Type */}
                  <div className="flex gap-3">
                    {[
                      { id: 'mobile_money' as const, icon: '📱', label: 'Mobile Money' },
                      { id: 'card' as const, icon: '💳', label: 'Debit / Credit Card' },
                    ].map(type => (
                      <button
                        key={type.id}
                        onClick={() => setPaymentType(type.id)}
                        className={`flex-1 py-4 px-3 rounded-xl text-sm transition-all ${
                          paymentType === type.id
                            ? 'bg-black text-white shadow-md'
                            : 'bg-white text-gray-600 border border-gray-200'
                        }`}
                      >
                        <span className="text-xl">{type.icon}</span>
                        <p className="mt-1 font-medium">{type.label}</p>
                      </button>
                    ))}
                  </div>


                  {/* Step 2: Show Relevant Input Fields */}
                  {paymentType === 'mobile_money' ? (
                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Select Network Provider</label>
                        <select
                          value={mobileMoneyProvider}
                          onChange={(e) => setMobileMoneyProvider(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-black"
                        >
                          <option value="MTN">MTN Mobile Money</option>
                          <option value="Telecel">Telecel Cash</option>
                          <option value="AirtelTigo">AirtelTigo Money</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Mobile Money Number</label>
                        <input
                          type="tel"
                          value={mobileMoneyNumber}
                          onChange={(e) => setMobileMoneyNumber(e.target.value)}
                          placeholder="e.g. 024XXXXXXX"
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Card Number</label>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          placeholder="1234 5678 9012 3456"
                          maxLength={19}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Expiry Date</label>
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            placeholder="MM/YY"
                            maxLength={5}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Cardholder Name</label>
                          <input
                            type="text"
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            placeholder="John Doe"
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black"
                          />
                        </div>
                      </div>
                    </div>
                  )}


                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-3">
                    <button 
                      onClick={() => {
                        setShowAddPayment(false);
                        setMobileMoneyNumber('');
                        setCardNumber('');
                        setCardExpiry('');
                        setCardName('');
                      }}
                      className="flex-1 py-3 text-sm border border-gray-200 rounded-lg font-medium text-gray-600"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={addPaymentMethod}
                      className="flex-1 py-3 text-sm bg-black text-white rounded-lg font-medium"
                    >
                      Save Payment
                    </button>
                  </div>
                </div>
              )}


              <p className="text-xs text-gray-400 mt-4 text-center">
                💡 Mobile Money is recommended for instant payments in Ghana
              </p>
            </div>
          </div>
        )}


        {/* ========== SETTINGS TAB ========== */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-5">
              <h2 className="text-base font-semibold">Notifications</h2>
              
              {[
                { key: 'rideUpdates' as const, label: 'Ride Status Updates', desc: 'Driver arrival, ride start & end alerts' },
                { key: 'promotions' as const, label: 'Promotions & Offers', desc: 'Special discounts and deals' },
                { key: 'emailReceipts' as const, label: 'Email Receipts', desc: 'Trip summaries sent to your email' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => toggleNotification(item.key)}
                    className={`w-12 h-7 rounded-full transition-colors relative ${
                      notificationPrefs[item.key] ? 'bg-black' : 'bg-gray-300'
                    }`}
                  >
                    <span 
                      className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        notificationPrefs[item.key] ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>


            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-1">
              <h2 className="text-base font-semibold mb-3">More</h2>
              
              {[
                { label: 'Language', value: 'English' },
                { label: 'Privacy Policy', value: '' },
                { label: 'Terms of Service', value: '' },
                { label: 'Help & Support', value: 'support@rydnow.com' },
              ].map(item => (
                <button 
                  key={item.label} 
                  className="w-full flex items-center justify-between py-3 border-b border-gray-50 last:border-b-0"
                >
                  <span className="text-sm font-medium text-gray-900">{item.label}</span>
                  <div className="flex items-center gap-2">
                    {item.value && <span className="text-xs text-gray-400">{item.value}</span>}
                    <span className="text-gray-300">›</span>
                  </div>
                </button>
              ))}
            </div>


            <button
              onClick={handleLogout}
              className="w-full bg-red-50 text-red-600 py-3 rounded-xl font-semibold text-sm mb-8 hover:bg-red-100"
            >
              Log Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

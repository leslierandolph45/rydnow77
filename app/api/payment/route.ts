import { NextResponse } from 'next/server'

export async function GET() {
return NextResponse.json({ message: "Payment API is working!" })
}

export async function POST(request: Request) {
try {
const {
bookingId,
amount,
currency,
paymentMethod, // 'momo' or 'card'
phoneNumber, // for Mobile Money
cardDetails, // for Visa/Mastercard
customerName,
customerId
} = await request.json()

// Required fields validation
if (!bookingId || !amount || !paymentMethod) {
return NextResponse.json(
{ error: 'Booking ID, amount and payment method are required' },
{ status: 400 }
)
}

// Validate payment method
if (!['momo', 'card'].includes(paymentMethod)) {
return NextResponse.json(
{ error: 'Payment method must be "momo" or "card"' },
{ status: 400 }
)
}

// Validate Mobile Money needs phone number
if (paymentMethod === 'momo' && !phoneNumber) {
return NextResponse.json(
{ error: 'Phone number is required for Mobile Money' },
{ status: 400 }
)
}

// Generate transaction record
const transaction = {
id: `TX${Date.now()}`,
bookingId,
amount: parseFloat(amount).toFixed(2),
currency: currency || 'GHS',
paymentMethod,
status: 'processing',
customerName,
customerId,
companyReceives: parseFloat(amount * 0.8).toFixed(2), // 80% to rider
companyFee: parseFloat(amount * 0.2).toFixed(2), // 20% company commission
createdAt: new Date().toISOString()
}

// Simulate successful payment
transaction.status = 'completed'

return NextResponse.json({
success: true,
message: paymentMethod === 'momo'
? 'Payment initiated — please approve on your phone'
: 'Payment processed successfully',
transaction
}, { status: 200 })

} catch (error) {
return NextResponse.json(
{ error: 'Payment failed. Please try again.' },
{ status: 500 }
)
}
}
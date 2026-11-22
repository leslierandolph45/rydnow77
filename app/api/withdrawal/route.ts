import { NextResponse } from 'next/server'

export async function GET() {
return NextResponse.json({ message: "Rider Withdrawal API is working!" })
}

export async function POST(request: Request) {
try {
const {
riderId,
riderName,
amount,
phoneNumber,
paymentMethod = 'momo',
notes = ''
} = await request.json()

// Validate required fields
if (!riderId || !amount || !phoneNumber) {
return NextResponse.json(
{ error: 'Rider ID, amount and phone number are required' },
{ status: 400 }
)
}

const amountNum = parseFloat(amount)

// Minimum withdrawal check
if (amountNum < 10) {
return NextResponse.json(
{ error: 'Minimum withdrawal amount is GHS 10.00' },
{ status: 400 }
)
}

// Create withdrawal record
const withdrawal = {
id: `WD${Date.now()}`,
riderId,
riderName,
amount: amountNum.toFixed(2),
phoneNumber,
paymentMethod,
status: 'pending', // pending → approved → completed → rejected
notes,
requestedAt: new Date().toISOString()
}

return NextResponse.json({
success: true,
message: `Withdrawal request of GHS ${withdrawal.amount} submitted! Waiting for admin approval.`,
withdrawal
}, { status: 201 })

} catch (error) {
return NextResponse.json(
{ error: 'Failed to submit withdrawal request. Please try again.' },
{ status: 500 }
)
}
}
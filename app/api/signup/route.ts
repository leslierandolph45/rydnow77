import { NextResponse } from 'next/server'

export async function GET() {
return NextResponse.json({ message: "Signup API is working!" })
}

export async function POST(request: Request) {
try {
const { name, email, phone, password, role = 'customer' } = await request.json()

if (!name || !email || !password) {
return NextResponse.json(
{ error: 'Name, email and password are required' },
{ status: 400 }
)
}

return NextResponse.json({
success: true,
message: 'Account created successfully!',
user: { name, email, phone, role, status: role === 'rider' ? 'pending' : 'active' }
}, { status: 201 })

} catch (error) {
return NextResponse.json(
{ error: 'Something went wrong. Please try again.' },
{ status: 500 }
)
}
}

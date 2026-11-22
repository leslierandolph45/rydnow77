export default function PaymentPage() {
return (
<div style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
<h1>Payment</h1>
<p>Select your payment method:</p>
<div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
<button style={{ padding: '0.8rem', fontSize: '1rem' }}>MTN Mobile Money</button>
<button style={{ padding: '0.8rem', fontSize: '1rem' }}>Visa / Card</button>
</div>
</div>
)
}
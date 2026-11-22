export async function POST(request) {
  try {
    const data = await request.json()
    
    // Add status
    const newApplication = {
      ...data,
      status: 'pending'
    }
    
    console.log('✅ NEW RIDER APPLICATION:')
    console.log(JSON.stringify(newApplication, null, 2))
    
    // Return data so frontend can save it
    return Response.json({ 
      success: true,
      application: newApplication,
      message: 'Application submitted successfully'
    }, { status: 200 })
    
  } catch (error) {
    console.error('❌ API Error:', error)
    return Response.json({ 
      success: false, 
      error: 'Failed to submit' 
    }, { status: 500 })
  }
}

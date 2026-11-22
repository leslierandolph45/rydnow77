const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  
  const allUploaded = Object.values(uploadStatus).every(v => v !== '')
  if (!allUploaded) {
    alert('Please upload all required documents')
    return
  }

  setIsSubmitting(true)
  
  // ✅ FIX: Check if we have signup data first
  const savedData = sessionStorage.getItem('riderSignupData')
  
  if (!savedData) {
    alert('⚠️ Your session expired. Please go back and fill the form again.')
    setIsSubmitting(false)
    router.push('/rider-signup')
    return
  }

  try {
    const res = await fetch('/api/rider-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...JSON.parse(savedData),
        documents: uploadStatus,
        submittedAt: new Date().toISOString()
      })
    })

    if (res.ok) {
      sessionStorage.removeItem('riderSignupData')
      alert('✅ Application submitted successfully!')
      router.push('/')
    } else {
      throw new Error('Server error')
    }
  } catch (err) {
    alert('❌ Something went wrong. Please try again.')
  } finally {
    setIsSubmitting(false)
  }
}

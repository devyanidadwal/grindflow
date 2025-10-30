'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  planName: string
  planPrice: number
}

function PaymentForm({ planName, planPrice, onClose }: { planName: string; planPrice: number; onClose: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [cardholderName, setCardholderName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      toast.error('Stripe has not loaded yet')
      return
    }

    if (!cardholderName.trim()) {
      toast.error('Please enter cardholder name')
      return
    }

    setProcessing(true)

    try {
      // Create payment intent on the server
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: planPrice,
          planName: planName,
        }),
      })

      const { clientSecret, error: backendError } = await response.json()

      if (backendError) {
        throw new Error(backendError)
      }

      // Confirm the payment with the card details
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        throw new Error('Card element not found')
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: cardholderName,
          },
        },
      })

      if (error) {
        // Handle specific error types with user-friendly messages
        let errorMessage = error.message || 'Payment failed. Please try again.'
        
        if (error.code === 'card_declined') {
          errorMessage = '❌ Your card was declined. Please try a different card.'
        } else if (error.code === 'insufficient_funds') {
          errorMessage = '💳 Insufficient funds. Please use a different card.'
        } else if (error.code === 'incorrect_cvc') {
          errorMessage = '🔒 Incorrect CVV code. Please check and try again.'
        } else if (error.code === 'expired_card') {
          errorMessage = '⏰ Your card has expired. Please use a valid card.'
        } else if (error.code === 'processing_error') {
          errorMessage = '⚠️ Payment processing error. Please try again.'
        } else if (error.message?.includes('test mode')) {
          errorMessage = '🧪 Invalid test card. Use test card: 4242 4242 4242 4242'
        }
        
        toast.error(errorMessage)
        setProcessing(false)
        return
      }

      if (paymentIntent?.status === 'succeeded') {
        toast.success(`🎉 Payment successful! Welcome to ${planName} plan!`)
        onClose()
      }
    } catch (error: any) {
      console.error('Payment error:', error)
      
      // Handle generic errors
      let errorMessage = 'Payment failed. Please try again.'
      
      if (error.message?.includes('test mode') || error.message?.includes('non test card')) {
        errorMessage = '🧪 Invalid card. Please use a valid test card: 4242 4242 4242 4242'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Cardholder Name */}
      <div>
        <label htmlFor="cardholderName" className="block text-sm font-medium text-white mb-2">
          Cardholder Name
        </label>
        <input
          type="text"
          id="cardholderName"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          placeholder="John Doe"
          required
          className="input-field w-full"
        />
      </div>

      {/* Card Details */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Card Details
        </label>
        <div className="input-field w-full">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#eaf0ff',
                  '::placeholder': {
                    color: '#9aa4b2',
                  },
                },
                invalid: {
                  color: '#ff6b6b',
                },
              },
            }}
          />
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={processing || !stripe}
        className="w-full bg-accent text-[#071129] font-bold py-3 px-6 rounded-xl hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6"
      >
        {processing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing Payment...
          </span>
        ) : (
          `Pay $${planPrice}/month`
        )}
      </button>
    </form>
  )
}

export default function PaymentModal({ isOpen, onClose, planName, planPrice }: PaymentModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative bg-card rounded-2xl shadow-2xl max-w-md w-full p-8 border border-white/10">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Payment Details</h2>
          <p className="text-muted text-sm">
            Subscribe to <span className="text-accent font-semibold">{planName}</span> plan
          </p>
          <p className="text-white text-lg font-bold mt-2">${planPrice}/month</p>
        </div>

        {/* Stripe Elements Wrapper */}
        <Elements stripe={stripePromise}>
          <PaymentForm planName={planName} planPrice={planPrice} onClose={onClose} />
        </Elements>

        {/* Security Notice */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
          <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Secure payment powered by Stripe</span>
        </div>
      </div>
    </div>
  )
}


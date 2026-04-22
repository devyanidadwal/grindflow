import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <SignUp routing="path" path="/login" signInUrl="/signin" fallbackRedirectUrl="/onboarding" />
    </div>
  )
}

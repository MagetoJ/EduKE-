import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { buttonVariants } from '../components/ui/button'
import { cn } from '../lib/utils'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams])

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus('error')
        setMessage('Invalid verification link. Please request a new one.')
        return
      }

      setStatus('loading')

      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Unable to verify email')
        }

        setStatus('success')
        setMessage(data.message || 'Your email has been verified successfully.')
      } catch (err) {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Unable to verify email')
      }
    }

    verify()
  }, [token])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email verification</CardTitle>
          <CardDescription>
            {status === 'success'
              ? 'Your account is now active. You can sign in using your credentials.'
              : 'We are confirming your email address.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-700">
            {message || 'Hang tight while we complete this step.'}
          </p>

          {status === 'loading' && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span>Verifying your email...</span>
            </div>
          )}

          {status === 'success' && (
            <Link
              to="/login"
              className={cn(buttonVariants({}), 'w-full text-center')}
            >
              Go to login
            </Link>
          )}

          {status === 'error' && (
            <div className="space-y-2">
              <Link
                to="/register-school"
                className={cn(buttonVariants({ variant: 'outline' }), 'w-full text-center')}
              >
                Register again
              </Link>
              <p className="text-xs text-gray-500">
                If this keeps happening, please contact support for further assistance.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

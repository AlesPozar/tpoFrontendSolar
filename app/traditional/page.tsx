"use client"

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { ArrowLeft } from 'lucide-react'
import { BankDashboard } from '@/components/bank-dashboard'
import { Button } from '@/components/ui/button'

export default function TraditionalPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()

  if (isLoaded && !user) {
    router.replace('/sign-in')
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between gap-4 px-6 pt-6">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Traditional assets overview</p>
          <h1 className="text-xl font-semibold text-foreground">Traditional assets and bank accounts</h1>
        </div>

        <Button asChild variant="outline" className="bg-transparent border-border">
          <Link href="/">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to overview
          </Link>
        </Button>
      </div>

      <BankDashboard />
    </div>
  )
}

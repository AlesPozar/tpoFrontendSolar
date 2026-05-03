'use client'

import { useRouter } from 'next/navigation'
import { useClerk, useUser } from '@clerk/nextjs'

export default function Test() {
  const router = useRouter()
  const { signOut } = useClerk()
  const { user, isLoaded } = useUser()

  async function handleLogout() {
    await signOut(() => router.replace('/sign-in'), { redirectUrl: '/sign-in' })
  }

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div className="flex flex-col items-start gap-3">
      <div>{user ? user.id : 'Not logged in'}</div>
      {user && (
        <button
          onClick={handleLogout}
          className="h-9 px-4 rounded-lg bg-[oklch(0.20_0_0)] hover:bg-[oklch(0.24_0_0)] border border-border text-sm text-foreground transition-colors cursor-pointer"
        >
          Log out
        </button>
      )}
    </div>
  )
}
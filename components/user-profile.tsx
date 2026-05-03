'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Pencil, Check, X, LogOut, Trash2, AlertTriangle, User, Euro, DollarSign, Coins, KeyRound, Eye, EyeOff } from 'lucide-react'
//import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useClerk, useUser } from '@clerk/nextjs'

type UserProfileProps = {
  onBack: () => void
}

export function UserProfile({ onBack }: UserProfileProps) {
  const router = useRouter()

  //fake data pred loudom pravim
  const userProfile = { 
    nickname: 'Alice Example',
    avatarUrl: null,
    displayedCurrency: '$'
  }

  //const userProfile = useStore((s) => s.userProfile)
  //const updateProfile = useStore((s) => s.updateProfile)
  //const resetAccount = useStore((s) => s.resetAccount)

  const [editingNickname, setEditingNickname] = useState(false)
  const [nicknameInput, setNicknameInput] = useState('User')
  const [nicknameError, setNicknameError] = useState<string | null>(null)
  const [savingNickname, setSavingNickname] = useState(false)
  const [avatarActionError, setAvatarActionError] = useState<string | null>(null)
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false)
  const [accountActionError, setAccountActionError] = useState<string | null>(null)
  const [passwordActionError, setPasswordActionError] = useState<string | null>(null)
  const [passwordActionSuccess, setPasswordActionSuccess] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  const selectedCurrency = userProfile.displayedCurrency ?? '$'

  const fileInputRef = useRef<HTMLInputElement>(null)



  //clerk
  const { user, isLoaded } = useUser() //dobi trenutnega userja, če je prijavljen, sicer null, uporableno za nickname,...
  const { signOut } = useClerk()

  const canChangePassword = Boolean(isLoaded && user && user.passwordEnabled)

  function displayedNickname() {
    const nickname = user?.unsafeMetadata?.nickname
    if (typeof nickname === 'string' && nickname.trim()) return nickname.trim()
    return 'User'
  }

  function displayedPicture() {
    if (user?.imageUrl) return user.imageUrl
    return null
  }

  useEffect(() => {
    if (!editingNickname) {
      setNicknameInput(displayedNickname())
    }
  }, [isLoaded, user, editingNickname])
  

{/*const initials = (userProfile.nickname ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)*/}

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setAvatarActionError('Please choose an image file.')
      e.target.value = ''
      return
    }

    if (!isLoaded || !user) {
      setAvatarActionError('User is not loaded yet. Try again.')
      e.target.value = ''
      return
    }

    try {
      setIsUpdatingAvatar(true)
      setAvatarActionError(null)
      await user.setProfileImage({ file })
    } catch (err: unknown) {
      const clerkMessage =
        typeof err === 'object' &&
        err !== null &&
        'errors' in err &&
        Array.isArray((err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors) &&
        (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0]
          ? (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].longMessage ||
            (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].message
          : null

      setAvatarActionError(clerkMessage || 'Could not update profile picture.')
    } finally {
      setIsUpdatingAvatar(false)
    }

    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  async function handleAvatarRemove() {
    if (!isLoaded || !user) {
      setAvatarActionError('User is not loaded yet. Try again.')
      return
    }

    try {
      setIsUpdatingAvatar(true)
      setAvatarActionError(null)
      await user.setProfileImage({ file: null })
    } catch (err: unknown) {
      const clerkMessage =
        typeof err === 'object' &&
        err !== null &&
        'errors' in err &&
        Array.isArray((err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors) &&
        (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0]
          ? (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].longMessage ||
            (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].message
          : null

      setAvatarActionError(clerkMessage || 'Could not remove profile picture.')
    } finally {
      setIsUpdatingAvatar(false)
    }
  }

  async function saveNickname() {
    const trimmed = nicknameInput.trim()
    if (!trimmed) {
      setNicknameError('Nickname cannot be empty.')
      return
    }

    if (!isLoaded || !user) {
      setNicknameError('User is not loaded yet. Try again.')
      return
    }

    try {
      setSavingNickname(true)
      setNicknameError(null)
      await user.update({ unsafeMetadata: { ...user.unsafeMetadata, nickname: trimmed } })
    } catch (err: unknown) {
      const clerkMessage =
        typeof err === 'object' &&
        err !== null &&
        'errors' in err &&
        Array.isArray((err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors) &&
        (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0]
          ? (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].longMessage ||
            (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].message
          : null

      setNicknameError(clerkMessage || 'Could not update nickname.')
      return
    } finally {
      setSavingNickname(false)
    }

    setEditingNickname(false)
  }

  function cancelNickname() {
    setNicknameInput(displayedNickname())
    setNicknameError(null)
    setEditingNickname(false)
  }

  async function handleSignOut() {
    if (!isLoaded) return

    try {
      setIsSigningOut(true)
      setAccountActionError(null)
      await signOut({ redirectUrl: '/sign-in' })
    } catch (err: unknown) {
      const clerkMessage =
        typeof err === 'object' &&
        err !== null &&
        'errors' in err &&
        Array.isArray((err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors) &&
        (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0]
          ? (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].longMessage ||
            (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].message
          : null

      setAccountActionError(clerkMessage || 'Could not sign out. Please try again.')
    } finally {
      setIsSigningOut(false)
      setShowSignOutConfirm(false)
    }
  }

  async function handleDeleteAccount() {
    if (!isLoaded || !user) return

    try {
      setIsDeletingAccount(true)
      setAccountActionError(null)
      await user.delete()
      router.replace('/sign-up')
    } catch (err: unknown) {
      const clerkMessage =
        typeof err === 'object' &&
        err !== null &&
        'errors' in err &&
        Array.isArray((err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors) &&
        (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0]
          ? (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].longMessage ||
            (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].message
          : null

      setAccountActionError(clerkMessage || 'Could not delete account. Please try again.')
      setShowDeleteConfirm(false)
    } finally {
      setIsDeletingAccount(false)
    }
  }

  async function handleChangePassword() {
    if (!isLoaded || !user) return

    const trimmedCurrent = currentPassword
    const trimmedNew = newPassword
    const trimmedConfirm = confirmNewPassword

    setPasswordActionSuccess(null)

    if (!trimmedCurrent) {
      setPasswordActionError('Please enter your current password.')
      return
    }

    if (!trimmedNew) {
      setPasswordActionError('Please enter a new password.')
      return
    }

    if (trimmedNew !== trimmedConfirm) {
      setPasswordActionError('New passwords do not match.')
      return
    }

    try {
      setIsUpdatingPassword(true)
      setPasswordActionError(null)
      await user.updatePassword({ currentPassword: trimmedCurrent, newPassword: trimmedNew })
      setPasswordActionSuccess('Password updated.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setShowChangePassword(false)
      setShowCurrentPassword(false)
      setShowNewPassword(false)
      setShowConfirmNewPassword(false)
    } catch (err: unknown) {
      const clerkMessage =
        typeof err === 'object' &&
        err !== null &&
        'errors' in err &&
        Array.isArray((err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors) &&
        (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0]
          ? (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].longMessage ||
            (err as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0].message
          : null

      setPasswordActionError(clerkMessage || 'Could not update password. Please try again.')
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[oklch(0.20_0_0)] transition-colors"
          aria-label="Go back"
        >
          <X className="w-4 h-4" />
        </button>
        <h1 className="text-base font-semibold text-foreground">Profile Settings</h1>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 py-10 gap-8 max-w-lg mx-auto w-full">

        {/* Avatar section */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-[oklch(0.72_0.19_45_/_0.15)] ring-2 ring-[oklch(0.72_0.19_45_/_0.4)] flex items-center justify-center">
              {displayedPicture() != null && (
                <img
                  src={displayedPicture()!}
                  alt="User Avatar"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            {/* Edit overlay */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUpdatingAvatar}
              className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Change profile picture"
            >
              <Camera className="w-6 h-6 text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
              aria-label="Upload profile picture"
            />
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUpdatingAvatar}
            className="text-xs text-[oklch(0.72_0.19_45)] hover:text-[oklch(0.80_0.19_45)] transition-colors"
          >
            {isUpdatingAvatar ? 'Updating picture...' : 'Change profile picture'}
          </button>
          {displayedPicture() != null && (
            <button
              onClick={handleAvatarRemove}
              disabled={isUpdatingAvatar}
              className="text-xs text-muted-foreground hover:text-[oklch(0.60_0.20_25)] transition-colors -mt-2"
            >
              Remove photo
            </button>
          )}
          {avatarActionError && (
            <p className="text-xs text-[oklch(0.60_0.20_25)]">{avatarActionError}</p>
          )}
        </div>

        {/* Profile section */}
        <div className="w-full bg-[oklch(0.16_0_0)] rounded-xl border border-border p-5 flex flex-col gap-3">
          {/* Display name section */}
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Display Name</span>
          </div>
          {editingNickname ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveNickname()
                  if (e.key === 'Escape') cancelNickname()
                }}
                maxLength={32}
                className="flex-1 h-9 px-3 rounded-lg bg-[oklch(0.20_0_0)] border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.72_0.19_45_/_0.5)]"
                aria-label="Edit display name"
              />
              <button
                onClick={saveNickname}
                disabled={savingNickname}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-[oklch(0.72_0.19_45_/_0.15)] text-[oklch(0.72_0.19_45)] hover:bg-[oklch(0.72_0.19_45_/_0.25)] transition-colors"
                aria-label="Save nickname"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={cancelNickname}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[oklch(0.20_0_0)] transition-colors"
                aria-label="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : null}
          {editingNickname && nicknameError && (
            <p className="text-xs text-[oklch(0.60_0.20_25)]">{nicknameError}</p>
          )}
          {!editingNickname && (
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-foreground">{displayedNickname()}</span>
              <button
                onClick={() => { setNicknameError(null); setNicknameInput(displayedNickname()); setEditingNickname(true) }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-[oklch(0.20_0_0)]"
                aria-label="Edit display name"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </button>
            </div>
          )}
          
          {/* Currency section */}
          {/*
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Displayed Currency</span>
          </div>
          
          <div className="w-full flex items-center bg-[oklch(0.20_0_0)] rounded-lg p-1 border border-border">
            <button
              onClick={() => null} // updateProfile({ displayedCurrency: '€' })}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-md font-medium text-sm transition-all',
                selectedCurrency === '€'
                  ? 'bg-[oklch(0.72_0.19_45_/_0.4)] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Euro className="w-4 h-4" />
              EUR
            </button>
            <button
              onClick={() => null} // updateProfile({ displayedCurrency: '$' })}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-md font-medium text-sm transition-all',
                selectedCurrency === '$'
                  ? 'bg-[oklch(0.72_0.19_45_/_0.4)] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <DollarSign className="w-4 h-4" />
              USD
            </button>
          </div>*/}
        </div>

        {/* Actions section */}
        <div className="w-full flex flex-col gap-3">
          {accountActionError && (
            <p className="text-xs text-[oklch(0.60_0.20_25)]">{accountActionError}</p>
          )}
          {passwordActionError && (
            <p className="text-xs text-[oklch(0.60_0.20_25)]">{passwordActionError}</p>
          )}
          {passwordActionSuccess && (
            <p className="text-xs text-[oklch(0.72_0.19_45)]">{passwordActionSuccess}</p>
          )}

          {/* Change password (email/password users only) */}
          {canChangePassword ? (
            !showChangePassword ? (
              <button
                onClick={() => {
                  setAccountActionError(null)
                  setPasswordActionError(null)
                  setPasswordActionSuccess(null)
                  setShowSignOutConfirm(false)
                  setShowDeleteConfirm(false)
                  setShowChangePassword(true)
                  setShowCurrentPassword(false)
                  setShowNewPassword(false)
                  setShowConfirmNewPassword(false)
                }}
                className="flex items-center gap-3 w-full px-5 py-4 rounded-xl bg-[oklch(0.16_0_0)] border border-border hover:border-[oklch(0.30_0_0)] hover:bg-[oklch(0.18_0_0)] transition-all text-left group"
              >
                <KeyRound className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="text-sm font-medium text-foreground">Change password</span>
              </button>
            ) : (
              <div className="flex flex-col gap-3 w-full px-5 py-4 rounded-xl bg-[oklch(0.20_0_0)] border border-border">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Current password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      className="w-full h-9 px-3 pr-10 rounded-lg bg-[oklch(0.16_0_0)] border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.72_0.19_45/0.5)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground">New password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full h-9 px-3 pr-10 rounded-lg bg-[oklch(0.16_0_0)] border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.72_0.19_45/0.5)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Confirm new password</label>
                  <div className="relative">
                    <input
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full h-9 px-3 pr-10 rounded-lg bg-[oklch(0.16_0_0)] border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.72_0.19_45/0.5)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      aria-label={showConfirmNewPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleChangePassword}
                    disabled={isUpdatingPassword}
                    className="flex-1 text-xs font-semibold text-foreground px-3 py-2 rounded-lg bg-[oklch(0.25_0_0)] hover:bg-[oklch(0.30_0_0)] transition-colors"
                  >
                    {isUpdatingPassword ? 'Updating...' : 'Update password'}
                  </button>
                  <button
                    onClick={() => {
                      setShowChangePassword(false)
                      setPasswordActionError(null)
                      setPasswordActionSuccess(null)
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmNewPassword('')
                      setShowCurrentPassword(false)
                      setShowNewPassword(false)
                      setShowConfirmNewPassword(false)
                    }}
                    className="flex-1 text-xs text-muted-foreground px-3 py-2 rounded-lg bg-[oklch(0.16_0_0)] hover:text-foreground hover:bg-[oklch(0.18_0_0)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )
          ) : null}

          {/* Sign out */}
          {!showSignOutConfirm ? (
            <button
              onClick={() => {
                setAccountActionError(null)
                setShowSignOutConfirm(true)
                setShowChangePassword(false)
                setPasswordActionError(null)
                setPasswordActionSuccess(null)
              }}
              className="flex items-center gap-3 w-full px-5 py-4 rounded-xl bg-[oklch(0.16_0_0)] border border-border hover:border-[oklch(0.30_0_0)] hover:bg-[oklch(0.18_0_0)] transition-all text-left group"
            >
              <LogOut className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-sm font-medium text-foreground">Sign out</span>
            </button>
          ) : (
            <div className="flex items-center gap-3 w-full px-5 py-4 rounded-xl bg-[oklch(0.20_0_0)] border border-border">
              <span className="text-sm text-muted-foreground flex-1">Sign out and return to overview?</span>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="text-xs font-medium text-foreground px-3 py-1.5 rounded-lg bg-[oklch(0.25_0_0)] hover:bg-[oklch(0.30_0_0)] transition-colors"
              >
                {isSigningOut ? 'Signing out...' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Delete account */}
          {!showDeleteConfirm ? (
            <button
              onClick={() => {
                setAccountActionError(null)
                setShowDeleteConfirm(true)
                setShowChangePassword(false)
                setPasswordActionError(null)
                setPasswordActionSuccess(null)
              }}
              className="flex items-center gap-3 w-full px-5 py-4 rounded-xl bg-[oklch(0.16_0_0)] border border-[oklch(0.60_0.20_25_/_0.2)] hover:border-[oklch(0.60_0.20_25_/_0.5)] hover:bg-[oklch(0.60_0.20_25_/_0.05)] transition-all text-left group"
            >
              <Trash2 className="w-4 h-4 text-[oklch(0.60_0.20_25)] opacity-70 group-hover:opacity-100 transition-opacity" />
              <div>
                <span className="text-sm font-medium text-[oklch(0.60_0.20_25)]">Delete account</span>
                <p className="text-xs text-muted-foreground mt-0.5">Permanently clears all portfolio data and settings</p>
              </div>
            </button>
          ) : (
            <div className="flex flex-col gap-3 w-full px-5 py-4 rounded-xl bg-[oklch(0.60_0.20_25_/_0.08)] border border-[oklch(0.60_0.20_25_/_0.35)]">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[oklch(0.60_0.20_25)] shrink-0 mt-0.5" />
                <p className="text-sm text-foreground font-medium">This will permanently delete all your portfolio data</p>
              </div>
              <p className="text-xs text-muted-foreground">All crypto holdings, bank accounts, connected wallets, and settings will be erased. This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount}
                  className="flex-1 text-xs font-semibold text-white px-3 py-2 rounded-lg bg-[oklch(0.50_0.20_25)] hover:bg-[oklch(0.55_0.20_25)] transition-colors"
                >
                  {isDeletingAccount ? 'Deleting...' : 'Yes, delete everything'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 text-xs text-muted-foreground px-3 py-2 rounded-lg bg-[oklch(0.20_0_0)] hover:text-foreground hover:bg-[oklch(0.25_0_0)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

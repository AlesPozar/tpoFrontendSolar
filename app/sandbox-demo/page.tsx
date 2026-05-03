'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SolaraLogo } from '@/components/logo'
import { Eye, EyeOff } from 'lucide-react'



/*
to je sandbox stran, da si boste lahko bolj podrobno vizualiziral komponente predn bojo implementirane v sam glavni workflow
npr ko bote delal dashboarde, jih lahko implementirate preden bo meni pa vse delal na glavni strani.
*/

export default function SignInPage() {


    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
            {/* tuki date poljubne komponente /commponents na katerih bote delal da jih lahko rendarate */}
            {/* recimo js sm gor iz commponents importu logo (import { SolaraLogo } from '@/components/logo'), in nato to komponento displayu odspodi  */}
            <SolaraLogo size={48} />
        </div>
    )
}
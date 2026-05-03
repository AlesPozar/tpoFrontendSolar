'use client'

import { BinancePortfolioDashboard } from '@/components/crypto-dashboard'

export default function SignInPage() {


    return (
        <div className="min-h-screen bg-background">
            {/* tuki date poljubne komponente /commponents na katerih bote delal da jih lahko rendarate */}
            <BinancePortfolioDashboard />
        </div>
    )
}

/*
primer, kaj dobimo z API callom semle:, basically, zanimajo nas samo balances
{
  "ok": true,
  "accountType": "SPOT",
  "canTrade": true,
  "balances": [
    { "asset": "BTC", "free": "0.00123", "locked": "0.0", "total": "0.00123" },
    { "asset": "USDT", "free": "42.50", "locked": "10.0", "total": "52.50" }
  ]
}
*/ 
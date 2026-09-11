'use client'

import { Monitor, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BackLink } from '@/components/layout/back-link'
import { detectPlatform, isStandaloneDisplay } from '@/lib/platform'

interface PlatformInstruction {
  id: 'ios' | 'android' | 'desktop'
  icon: React.ComponentType<{ className?: string }>
  title: string
  steps: string[]
}

const PLATFORM_INSTRUCTIONS: PlatformInstruction[] = [
  {
    id: 'ios',
    icon: Smartphone,
    title: 'On iPhone or iPad',
    steps: [
      'Tap the Share button in Safari.',
      'Scroll down and tap Add to Home Screen.',
      'Tap Add in the confirmation.',
    ],
  },
  {
    id: 'android',
    icon: Smartphone,
    title: 'On Android',
    steps: [
      'Tap the menu button (three dots) in Chrome.',
      'Tap Install app or Add to Home screen.',
      'Tap Add in the confirmation.',
    ],
  },
  {
    id: 'desktop',
    icon: Monitor,
    title: 'On Desktop',
    steps: [
      "Look for the install icon in your browser's address bar.",
      'Click it and follow the prompts.',
      "Or use your browser's menu to find Install option.",
    ],
  },
]

export default function InstallPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const platform = detectPlatform()
  const alreadyInstalled = isStandaloneDisplay()
  const detected = PLATFORM_INSTRUCTIONS.find((instruction) => instruction.id === platform)
  const instructions = detected
    ? [detected, ...PLATFORM_INSTRUCTIONS.filter((instruction) => instruction.id !== platform)]
    : PLATFORM_INSTRUCTIONS

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <BackLink href="/settings" />
        <h1 className="text-xl font-semibold text-gray-900">Install Home Pantry</h1>
      </div>

      <p className="mb-6 text-sm text-gray-500">
        Add Home Pantry to this phone from {mounted ? window.location.host : 'this address'}. A
        different address is a different app.
      </p>

      {mounted &&
        (alreadyInstalled ? (
          <output className="block text-sm text-gray-700">
            Home Pantry is already on this phone's home screen.
          </output>
        ) : (
          <div className="space-y-4">
            {instructions.map((instruction) => {
              const isActive = instruction.id === platform
              return (
                <div
                  key={instruction.id}
                  className={`rounded-xl border p-4 shadow-sm ${
                    isActive ? 'border-emerald-500 bg-emerald-50/50' : 'border-gray-200'
                  }`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <instruction.icon
                      className={`h-5 w-5 ${isActive ? 'text-emerald-600' : 'text-gray-500'}`}
                    />
                    <h2
                      className={`font-medium ${isActive ? 'text-emerald-900' : 'text-gray-700'}`}
                    >
                      {instruction.title}
                    </h2>
                  </div>
                  <ol className="ml-4 list-decimal space-y-1">
                    {instruction.steps.map((step) => (
                      <li
                        key={step}
                        className={`text-sm ${isActive ? 'text-emerald-800' : 'text-gray-600'}`}
                      >
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )
            })}
          </div>
        ))}
    </div>
  )
}

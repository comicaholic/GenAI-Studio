import React, { PropsWithChildren, useState } from 'react'
import ModelSelector from './TopBar/ModelSelector'

export default function AppShell({
  children,
  left,
  right,
}: PropsWithChildren<{ left?: React.ReactNode; right?: React.ReactNode }>) {
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)

  return (
    <div className="flex h-screen flex-col">  {/* h-screen + not h-dvh for Windows scrollbars */}
    {/* TOP */}
    <div className="sticky top-0 z-40 h-14 border-b border-neutral-200/60 dark:border-neutral-800/60
                    bg-white/70 dark:bg-neutral-900/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container-page h-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="icon-btn" onClick={() => setLeftOpen(v => !v)} aria-label="Toggle left" />
          <span className="font-semibold">GenAI Studio</span>
        </div>
        <div className="flex items-center gap-2">
          {/* put ModelSelector HERE so it doesn't scroll out */}
          <ModelSelector />
          <button className="icon-btn" onClick={() => setRightOpen(v => !v)} aria-label="Toggle right" />
        </div>
      </div>
    </div>

    {/* BODY */}
    <div className="flex flex-1 min-h-0"> {/* min-h-0 prevents ghost scrollbars */}
      {/* LEFT NAV + LEFT PANEL glued together */}
      {left && (
        <aside className={`min-h-0 overflow-y-auto border-r border-neutral-200/60 dark:border-neutral-800/60
                          bg-white dark:bg-neutral-900 transition-all duration-200
                          ${leftOpen ? 'w-72' : 'w-0'}`}>
          {/* no padding wrapper to avoid visible gap */}
          {leftOpen && left}
        </aside>
      )}

      {/* MAIN SCROLL ONLY THE CONTENT */}
      <main className="min-w-0 flex-1 min-h-0 overflow-y-auto">
        <div className="container-page py-6">{children}</div>
      </main>

      {/* RIGHT PANEL — independent scroll */}
      {right && (
        <aside className={`min-h-0 overflow-y-auto border-l border-neutral-200/60 dark:border-neutral-800/60
                          bg-white dark:bg-neutral-900 transition-all duration-200
                          ${rightOpen ? 'w-80' : 'w-0'}`}>
          {rightOpen && right}
        </aside>
      )}
    </div>
  </div>

  )
}

 'use client'
 
 import type { CSSProperties } from 'react'
 import { useTheme } from 'next-themes'
 import { Toaster as Sonner, ToasterProps } from 'sonner'
 
 const Toaster = ({ ...props }: ToasterProps) => {
   const { theme = 'system' } = useTheme()
 
   return (
     <Sonner
       theme={theme as ToasterProps['theme']}
       position="top-center"
       className="toaster group"
       toastOptions={{
         classNames: {
           toast:
             'mt-4 max-w-md rounded-xl border bg-white px-6 py-5 text-base shadow-lg md:max-w-xl md:px-8 md:py-6 md:text-lg',
           title: 'font-semibold',
           description: 'mt-1 text-sm md:text-base',
           actionButton:
             'rounded-md border border-black/10 bg-black px-3 py-2 text-sm font-medium text-white hover:bg-black/90',
           cancelButton:
             'rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50',
         },
       }}
       style={
         {
           '--normal-bg': 'var(--popover)',
           '--normal-text': 'var(--popover-foreground)',
           '--normal-border': 'var(--border)',
         } as CSSProperties
       }
       {...props}
     />
   )
 }
 
 export { Toaster }

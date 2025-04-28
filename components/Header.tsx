import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Pill, Home, MessageCircle, Calculator, Utensils } from "lucide-react"
import { useState } from 'react'
export function Header() {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <header 
      className="sticky top-0 z-50 w-full border-b border-orange-200 shadow-sm transition-all duration-300 hover:shadow-md bg-white/95 backdrop-blur-sm"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="container flex h-16 items-center">
        <div className="flex items-center justify-between w-full">
          <Link 
            href="/" 
            className="flex items-center space-x-2 animate-wiggle animate-twice ml-4"
          >
            <Pill 
              className={`h-8 w-8 text-[#FE3301] transition-transform duration-300 ${
                isHovered ? 'animate-pulse rotate-45' : ''
              }`} 
            />
            <span className="font-bold text-base text-[#FE3301] sm:inline-block font-sans">
              Med-Assistant
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link href="/">
              <Button 
                variant="ghost" 
                className="flex items-center text-[#FE3301] hover:text-orange-800 hover:bg-orange-100 transition-all duration-300 hover:-translate-y-1"
              >
                <Home className="mr-2 h-5 w-5 transition-transform duration-300 animate-bounce animate-twice" />
                <span className="hidden sm:inline">Home</span>
              </Button>
            </Link>
            <Link href="/chat">
              <Button 
                variant="ghost" 
                className="flex items-center text-[#FE3301] hover:text-orange-800 hover:bg-orange-100 transition-all duration-300 hover:-translate-y-1"
              >
                <MessageCircle className="mr-2 h-5 w-5 transition-transform duration-300 hover:rotate-12" />
                <span className="hidden sm:inline">Chat</span>
              </Button>
            </Link>
            <Link href="/meds">
              <Button 
                variant="ghost" 
                className="flex items-center text-[#FE3301] hover:text-orange-800 hover:bg-orange-100 transition-all duration-300 hover:-translate-y-1"
              >
                <Pill className="mr-2 h-5 w-5 transition-transform duration-300 hover:rotate-12" />
                <span className="hidden sm:inline">Meds</span>
              </Button>
            </Link>
            <Link href="/calculator">
              <Button 
                variant="ghost" 
                className="flex items-center text-[#FE3301] hover:text-orange-800 hover:bg-orange-100 transition-all duration-300 hover:-translate-y-1"
              >
                <Calculator className="mr-2 h-5 w-5 transition-transform duration-300 hover:rotate-12" />
                <span className="hidden sm:inline">Calculator</span>
              </Button>
            </Link>
            <Link href="/food-analysis">
              <Button 
                variant="ghost" 
                className="flex items-center text-[#FE3301] hover:text-orange-800 hover:bg-orange-100 transition-all duration-300 hover:-translate-y-1"
              >
                <Utensils className="mr-2 h-5 w-5 transition-transform duration-300 hover:rotate-12" />
                <span className="hidden sm:inline">Food Analysis</span>
              </Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
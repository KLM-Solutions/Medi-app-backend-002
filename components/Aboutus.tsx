'use client'

import { useEffect, useState, useRef } from 'react'
import { Atom, Heart, FileText, BadgeIcon as IdCard } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

export default function AboutUs() {
  const [counts, setCounts] = useState({
    experience: 0,
    equipment: 0,
    staff: 0,
    years: 0,
    patients: 0,
    procedures: 0,
    doctors: 0
  })

  const sectionRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(true)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      {
        threshold: 0.2
      }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isVisible || !shouldAnimate) return

    const duration = 2000
    const start = Date.now()

    const timer = setInterval(() => {
      const timePassed = Date.now() - start
      const progress = Math.min(timePassed / duration, 1)

      setCounts({
        experience: Math.floor(progress * 80),
        equipment: Math.floor(progress * 65),
        staff: Math.floor(progress * 85),
        years: Math.floor(progress * 20),
        patients: Math.floor(progress * 700),
        procedures: Math.floor(progress * 120),
        doctors: Math.floor(progress * 40)
      })

      if (progress === 1) {
        clearInterval(timer)
        setShouldAnimate(false)
        
        // Reset after 3 seconds
        setTimeout(() => {
          setCounts({
            experience: 0,
            equipment: 0,
            staff: 0,
            years: 0,
            patients: 0,
            procedures: 0,
            doctors: 0
          })
          setShouldAnimate(true)
        }, 3000)
      }
    }, 50)

    return () => clearInterval(timer)
  }, [isVisible, shouldAnimate])

  return (
    <div className="relative" ref={sectionRef}>
      <div className="area">
        <ul className="circles">
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
        </ul>
      </div>

      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left column - Image */}
          <div>
            <img
              src="/glp-1-image-4.jpg"
              alt="Dental procedure"
              className="rounded-lg shadow-lg w-full"
            />
          </div>

          {/* Right column - Content */}
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-4xl font-bold">About Us</h2>
              <div className="w-20 h-1" style={{ backgroundColor: '#FE3301' }}></div>
            </div>

            <p className="text-gray-600">
              With over a decade of experience in supporting patients with GLP-1 medications, our dedicated team provides comprehensive guidance throughout your weight management journey. We combine medical expertise with personalized support to help you achieve sustainable results and improved well-being.
            </p>

            {/* Progress bars */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Experience Bot</span>
                  <span>{counts.experience}%</span>
                </div>
                <Progress value={counts.experience} className="h-2" style={{ 
                  '--progress-background': '#FE3301'
                } as React.CSSProperties} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Modern AI</span>
                  <span>{counts.equipment}%</span>
                </div>
                <Progress value={counts.equipment} className="h-2" style={{ 
                  '--progress-background': '#FE3301'
                } as React.CSSProperties} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Friendly Support</span>
                  <span>{counts.staff}%</span>
                </div>
                <Progress value={counts.staff} className="h-2" style={{ 
                  '--progress-background': '#FE3301'
                } as React.CSSProperties} />
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-12">
          <div className="flex flex-col items-center space-y-2">
            <Atom className="w-8 h-8" style={{ color: '#FE3301' }} />
            <span className="text-3xl font-bold">{counts.years}</span>
            <span className="text-gray-600">Bot Years Experience</span>
          </div>

          <div className="flex flex-col items-center space-y-2">
            <Heart className="w-8 h-8" style={{ color: '#FE3301' }} />
            <span className="text-3xl font-bold">{counts.patients}+</span>
            <span className="text-gray-600">Happy Patients</span>
          </div>

          <div className="flex flex-col items-center space-y-2">
            <FileText className="w-8 h-8" style={{ color: '#FE3301' }} />
            <span className="text-3xl font-bold">{counts.procedures}</span>
            <span className="text-gray-600">Procedures Done</span>
          </div>

          <div className="flex flex-col items-center space-y-2">
            <IdCard className="w-8 h-8" style={{ color: '#FE3301' }} />
            <span className="text-3xl font-bold">{counts.doctors}+</span>
            <span className="text-gray-600">Certified Bot</span>
          </div>
        </div>
      </div>
    </div>
  )
}
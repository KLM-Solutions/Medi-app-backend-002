import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Heart, MessageCircle } from "lucide-react"

interface Section1Props {
  isSignedIn: boolean;
  onSignIn: () => void;
}

const Section1: React.FC<Section1Props> = ({ isSignedIn, onSignIn }) => {
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(100);

  const words = [
    "Welcome to Medication Assistant",
    "Your Health Journey Partner",
    "Get Expert Guidance Today"
  ];

  useEffect(() => {
    const handleTyping = () => {
      const currentIndex = loopNum % words.length;
      const currentWord = words[currentIndex];

      setText(prev => {
        if (isDeleting) {
          return currentWord.substring(0, prev.length - 1);
        }
        return currentWord.substring(0, prev.length + 1);
      });

      if (!isDeleting && text === currentWord) {
        setTimeout(() => setIsDeleting(true), 1500);
        setTypingSpeed(100);
      } else if (isDeleting && text === '') {
        setIsDeleting(false);
        setLoopNum(prev => prev + 1);
        setTypingSpeed(100);
      } else {
        setTypingSpeed(isDeleting ? 50 : 100);
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [text, isDeleting, loopNum, typingSpeed, words]);

  return (
    <>
      <section className="text-[#FE3301] relative">
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
        <div className="container mx-auto px-4 py-16 flex flex-col items-center text-center min-h-[calc(50vh-4rem)] relative z-10">
          <div className="flex items-center mb-6">
            <Heart className="w-12 h-12 text-[#FE3301] mr-4" />
            <h1 className="text-[#FE3301] text-4xl md:text-5xl lg:text-6xl font-bold font-sans">
              {text}
              <span className="animate-pulse">|</span>
            </h1>
          </div>
          
          <p className="text-black/80 text-lg md:text-xl lg:text-2xl mb-8 max-w-3xl font-sans animate-fade-left animate-once">
           Get expert insights , plan your lifestyle to better manage side effects,understand your medication, and more.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              asChild
              size="lg"
              className="bg-[#FE3301] text-white hover:bg-orange-600 transition-colors duration-300 animate-flip-up animate-once"
            >
              <a href="/chat" className="flex items-center">
                <MessageCircle className="mr-2 h-5 w-5" />
                Start Conversation
              </a>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}

export default Section1

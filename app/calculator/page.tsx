'use client'

import React from 'react'
import { useState, useEffect, useRef } from 'react'
import { useChat } from 'ai/react'
import Image from 'next/image'
import { Header } from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCw, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  timeOfDay: string[];
  notes?: string;
}

interface AnalysisResult {
  status: string;
  category: string;
  confidence: number;
  analysis: string;
  sources?: string;
  timestamp: string;
  id: string;
}

interface MedicationAlert {
  alertText: string;
}

interface PendingAnalysis {
  id: string;
  image: string;
  timestamp: number;
  retryCount: number;
}

interface FormattedResponse {
  content: string;
  metadata?: {
    category?: string;
    timestamp?: string;
    confidence?: number;
    sources?: Array<{
      title: string;
      url: string;
    }>;
  };
}

// Add these interfaces at the top of your file
interface AnalysisRequest {
  type: 'analysis_request';
  image: string;
  medications?: Medication[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
}

// Global state with a single source of truth
const globalState = {
  selectedImage: null as string | null,
  analysisResults: [] as AnalysisResult[],
  pendingAnalyses: new Map<string, PendingAnalysis>(),
  isProcessing: false,
  isAnalyzing: false,
};

// Constants
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT = 300000;
const generateId = () => Math.random().toString(36).substr(2, 9);

interface AnalysisRequestBody {
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    id?: string;
  }[];
  body?: {
    maxTokens?: number;
    temperature?: number;
  };
}

// Interface for nutritional information
interface NutritionalInfo {
  name: string;
  calories: {
    value: number;
    unit: string; // kcal
  };
  macronutrients: {
    carbohydrates: { value: number; unit: string; }; // g
    proteins: { value: number; unit: string; }; // g
    fats: { value: number; unit: string; }; // g
    fiber: { value: number; unit: string; }; // g
    water: { value: number; unit: string; }; // ml
  };
  micronutrients: {
    vitamins: {
      vitaminA: { value: number; unit: string; }; // IU or mcg
      vitaminB1: { value: number; unit: string; }; // mg
      vitaminB2: { value: number; unit: string; }; // mg
      vitaminB3: { value: number; unit: string; }; // mg
      vitaminB5: { value: number; unit: string; }; // mg
      vitaminB6: { value: number; unit: string; }; // mg
      vitaminB12: { value: number; unit: string; }; // mcg
      vitaminC: { value: number; unit: string; }; // mg
      vitaminD: { value: number; unit: string; }; // IU
      vitaminE: { value: number; unit: string; }; // mg
      vitaminK: { value: number; unit: string; }; // mcg
    };
    minerals: {
      calcium: { value: number; unit: string; }; // mg
      iron: { value: number; unit: string; }; // mg
      zinc: { value: number; unit: string; }; // mg
      magnesium: { value: number; unit: string; }; // mg
      potassium: { value: number; unit: string; }; // mg
      sodium: { value: number; unit: string; }; // mg
      phosphorus: { value: number; unit: string; }; // mg
      iodine: { value: number; unit: string; }; // mcg
      selenium: { value: number; unit: string; }; // mcg
    };
  };
}

const MessageContent = ({ content }: { content: string }) => {
  // Transform the content to add bold and bullet points
  const formattedContent = content.split('\n').map(line => {
    // Handle bold text
    line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Handle bullet points
    if (line.startsWith('*')) {
      line = `<li style="margin-bottom: 0.5rem">${line.substring(1).trim()}</li>`;
    } else if (line.trim()) {
      // Add margin to non-empty lines that aren't bullet points
      line = `<p style="margin-bottom: 1rem">${line}</p>`;
    }
    return line;
  }).join('\n');

  return (
    <div 
      className="space-y-2" 
      dangerouslySetInnerHTML={{ __html: formattedContent }} 
    />
  );
};

// Component for displaying nutritional breakdown
const NutritionalBreakdown = ({ nutritionalInfo }: { nutritionalInfo: NutritionalInfo }) => {
  return (
    <div className="bg-white/90 rounded-lg p-6 mt-4 space-y-6">
      <div className="border-b pb-4">
        <h3 className="text-xl font-semibold text-[#FE3301]">{nutritionalInfo.name}</h3>
        <div className="text-lg font-medium mt-2">
          {nutritionalInfo.calories.value} {nutritionalInfo.calories.unit}
        </div>
      </div>

      {/* Macronutrients Section */}
      <div>
        <h4 className="text-lg font-semibold mb-4">Macronutrients</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(nutritionalInfo.macronutrients).map(([key, value]) => (
            <div key={key} className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-lg font-medium">
                {value.value}
                <span className="text-sm ml-1">{value.unit}</span>
              </div>
              <div className="text-sm text-gray-600 capitalize">{key}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Micronutrients Section */}
      <div>
        <h4 className="text-lg font-semibold mb-4">Micronutrients</h4>
        
        {/* Vitamins */}
        <div className="mb-6">
          <h5 className="text-md font-medium mb-3">Vitamins</h5>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(nutritionalInfo.micronutrients.vitamins).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center bg-gray-50 rounded p-3">
                <span className="text-sm capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className="text-sm font-medium">
                  {value.value}
                  <span className="text-xs ml-1">{value.unit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Minerals */}
        <div>
          <h5 className="text-md font-medium mb-3">Minerals</h5>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(nutritionalInfo.micronutrients.minerals).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center bg-gray-50 rounded p-3">
                <span className="text-sm capitalize">{key}</span>
                <span className="text-sm font-medium">
                  {value.value}
                  <span className="text-xs ml-1">{value.unit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Calculator() {
  // Add refresh handler
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Clear all calculator-related data from localStorage
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('calculator-')) {
          localStorage.removeItem(key);
        }
      });
    };

    // Add event listener for page refresh
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup event listener
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Function to clear calculator data
  const clearCalculatorData = () => {
    // Clear all calculator-related data from localStorage
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('calculator-')) {
        localStorage.removeItem(key);
      }
    });
    // Force reload the page
    window.location.reload();
  };

  const [calculatorId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    
    // Try to get existing session ID first
    const stored = window.localStorage.getItem('currentCalculatorId');
    if (stored) {
      return stored;
    }
    
    // If no existing session, create new one and clean old sessions
    const newId = `calculator-${Date.now()}`;
    return newId;
  });

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [medicationAlert, setMedicationAlert] = useState<MedicationAlert | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);

  // Load stored data after mount
  useEffect(() => {
    if (typeof window === 'undefined' || !calculatorId) return;
    
    try {
      const storedImage = localStorage.getItem(`calculator-image-${calculatorId}`);
      if (storedImage) {
        setSelectedImage(storedImage);
      }
      
      const storedResults = localStorage.getItem(`calculator-results-${calculatorId}`);
      if (storedResults) {
        setAnalysisResults(JSON.parse(storedResults));
      }
      
      // Load medications from storage
      const storedMeds = localStorage.getItem('medications');
      if (storedMeds) {
        setMedications(JSON.parse(storedMeds));
      }
    } catch (e) {
      console.error('Error loading stored calculator data:', e);
    }
  }, [calculatorId]);

  // Move localStorage cleanup to useEffect
  useEffect(() => {
    if (!calculatorId) return;
    
    // Clear old calculator data
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('calculator-') && !key.includes(calculatorId)) {
        localStorage.removeItem(key);
      }
    });
    
    // Store current calculatorId
    localStorage.setItem('currentCalculatorId', calculatorId);
  }, [calculatorId]);

  // Store image when it changes
  useEffect(() => {
    if (selectedImage) {
      localStorage.setItem(`calculator-image-${calculatorId}`, selectedImage);
    }
  }, [selectedImage, calculatorId]);

  // Store analysis results when they change
  useEffect(() => {
    if (analysisResults.length > 0) {
      localStorage.setItem(`calculator-results-${calculatorId}`, JSON.stringify(analysisResults));
    }
  }, [analysisResults, calculatorId]);

  const parseMedicationAlert = (content: string) => {
    try {
      if (!content) throw new Error('Empty medication alert content');

      // The new format is a simple text alert
      return {
        alertText: content.trim() || 'No medication alerts available'
      };
    } catch (error) {
      console.error('Error parsing medication alert:', error);
      return {
        alertText: 'Failed to parse medication alert. Please consult with a healthcare professional.'
      };
    }
  };

  const analyzeImage = async () => {
    if (!selectedImage) {
      setError('No image selected');
      return;
    }
  
    setError(null);
    setIsLoading(true);
    setMedicationAlert(null);
  
    try {
      const requestBody = {
        messages: [{
          role: 'user' as const,
          content: JSON.stringify({
            type: 'analysis_request',
            image: selectedImage,
            medications: medications.length > 0 ? medications : undefined
          }),
          id: generateId()
        }]
      };
  
      const response = await fetch('/api/calculator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
  
      if (!response.ok) {
        throw new Error(`Failed to analyze image: ${response.statusText}`);
      }
  
      if (!response.body) {
        throw new Error('No response body received');
      }
  
      const reader = response.body.getReader();
      let analysisText = '';
      let medicationAlertText = '';
      let collectingMedicationAlert = false;
  
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(5).trim();
            if (data && data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'separator') {
                  if (parsed.content.includes('MEDICATION_ALERT_START')) {
                    collectingMedicationAlert = true;
                  } else if (parsed.content.includes('MEDICATION_ALERT_END')) {
                    collectingMedicationAlert = false;
                  }
                } else if (parsed.type === 'medication_alert' && parsed.content) {
                  medicationAlertText += parsed.content;
                } else if (parsed.type === 'analysis' && parsed.content) {
                  analysisText += parsed.content;
                } else if (parsed.content) {
                  // For backward compatibility with previous API format
                  analysisText += parsed.content;
                }
              } catch (e) {
                console.error('Error parsing chunk:', e);
              }
            }
          }
        }
      }
  
      const analysisData = parseAnalysisFromMessage(analysisText);
      
      const analysisResult: AnalysisResult = {
        id: generateId(),
        status: 'completed',
        category: analysisData.category || 'Unknown',
        confidence: analysisData.confidence || 0,
        analysis: analysisData.analysis || 'No analysis available',
        timestamp: new Date().toISOString()
      };
  
      setAnalysisResults(prev => [...prev, analysisResult]);
      
      // If we received medication alert data, parse and display it
      if (medicationAlertText) {
        const alert = parseMedicationAlert(medicationAlertText);
        setMedicationAlert(alert);
        
        // Log the medication alert to the console
        console.log("MEDICATION ALERT:", alert);
      }
  
    } catch (error) {
      console.error('Error analyzing image:', error);
      setError(error instanceof Error ? error.message : 'Failed to analyze image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const imageString = reader.result as string;
        setSelectedImage(imageString);
        setError(null);
        // Clear previous analysis results and medication alert
        setAnalysisResults([]);
        setMedicationAlert(null);
      }
      reader.readAsDataURL(file)
    }
  }

  const parseAnalysisFromMessage = (content: string) => {
    try {
      if (!content) throw new Error('Empty content');

      const lines = content.split('\n');
      let category = '';
      let confidence = 0;
      let analysis = '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('Category:')) {
          category = trimmedLine;
        } else if (trimmedLine.startsWith('Confidence:')) {
          confidence = parseFloat(trimmedLine.substring('Confidence:'.length).trim().replace('%', '')) || 0;
        } else {
          analysis += trimmedLine + '\n';
        }
      }

      return {
        category: category || 'Unknown',
        confidence: isNaN(confidence) ? 0 : confidence,
        analysis: analysis.trim() || 'No analysis available'
      };
    } catch (error) {
      console.error('Error parsing analysis:', error);
      return {
        category: 'Unknown',
        confidence: 0,
        analysis: 'Failed to parse analysis results'
      };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-t from-[#FFF5F2] via-[#FFF9F7] to-white">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-center text-[#FE3301]">
            Food Analysis Calculator
          </h1>
        </div>

        <div className="fixed inset-0 pointer-events-none">
          <div className="area">
            <ul className="circles">
              {[...Array(10)].map((_, index) => (
                <li key={index}></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative min-h-screen flex flex-col">
          <div className="flex-1 flex items-center justify-center p-4 relative z-20">
            <Card className={`h-[90vh] sm:h-[80vh] ${analysisResults.length > 0 ? 'w-[95%]' : 'w-[600px]'} mx-auto bg-white/80 backdrop-blur-sm`}>
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl font-bold text-[#FE3301] text-center">
                  Meal Analyzer
                </CardTitle>
                {medications.length > 0 && (
                  <div className="text-sm text-gray-500 text-center">
                    Analyzing with {medications.length} medication{medications.length !== 1 ? 's' : ''} from your profile
                  </div>
                )}
              </CardHeader>
              <CardContent className="h-[calc(100%-4rem)] sm:h-[calc(100%-5rem)] overflow-hidden">
                <div className={`h-full ${analysisResults.length > 0 ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'flex flex-col items-center justify-center'}`}>
                  {/* Left Column - Image Upload and Preview */}
                  <div className="flex flex-col items-center gap-6 w-full max-w-[300px] mx-auto">
                    <div className="flex justify-center w-full">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="w-full text-sm text-center text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#FE3301] file:text-white file:transition-colors file:hover:bg-[#FE3301]/90 hover:cursor-pointer bg-gray-400/80 rounded-full px-4 py-2"
                      />
                    </div>

                    {selectedImage && (
                      <div className="relative w-64 h-[300px] rounded-lg overflow-hidden shadow-lg transition-transform duration-300 hover:scale-105">
                        <Image
                          src={selectedImage}
                          alt="Selected food image"
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      </div>
                    )}

                    <div className="flex justify-center w-64">
                      <Button
                        onClick={analyzeImage}
                        disabled={!selectedImage || isLoading}
                        className="w-full bg-[#FE3301] text-white px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:bg-[#FE3301]/90 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] active:shadow-md focus:outline-none focus:ring-2 focus:ring-[#FE3301]/50"
                      >
                        <span className="inline-flex items-center justify-center">
                          {isLoading ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                              </svg>
                              Analyzing...
                            </>
                          ) : (
                            'Analyze Image'
                          )}
                        </span>
                      </Button>
                    </div>
                    
                    {/* Medication Status */}
                    {medications.length > 0 && (
                      <div className="text-sm text-gray-700 text-center mt-2">
                        <p>Your medication profile will be checked against food analysis for potential interactions</p>
                      </div>
                    )}
                  </div>

                  {/* Right Column - Analysis Results */}
                  {(error || analysisResults.length > 0) && (
                    <div className="h-full overflow-y-auto">
                      {error && (
                        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 animate-fadeIn">
                          {error}
                        </div>
                      )}
                      
                      {/* Medication Alert (if available) */}
                      {medicationAlert && (
                        <Alert className={`mb-4 ${
                          medicationAlert.alertText.toLowerCase().includes('avoid') || 
                          medicationAlert.alertText.toLowerCase().includes('caution') ? 
                          'bg-red-50 border-red-200' : 
                          'bg-green-50 border-green-200'
                        }`}>
                          <AlertTriangle className={`h-5 w-5 ${
                            medicationAlert.alertText.toLowerCase().includes('avoid') || 
                            medicationAlert.alertText.toLowerCase().includes('caution') ? 
                            'text-red-500' : 
                            'text-green-500'
                          }`} />
                          <div>
                            <h4 className="font-medium mb-1">Medication Alert</h4>
                            <AlertDescription>
                              <div className="text-sm">{medicationAlert.alertText}</div>
                            </AlertDescription>
                          </div>
                        </Alert>
                      )}
                      
                      {analysisResults.map((result, index) => (
                        <div key={index} className="mb-4">
                          <div className="font-semibold">{result.category}</div>
                          <div className="text-sm text-gray-600 mb-2">
                            Confidence: {result.confidence ? `${result.confidence}%` : 'N/A'}
                          </div>
                          <MessageContent content={result.analysis} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .area {
          background: white;
          width: 100%;
          height: 100vh;
          position: absolute;
          z-index: 1;
        }

        .circles {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          margin: 0;
          padding: 0;
        }

        .circles li {
          position: absolute;
          display: block;
          list-style: none;
          width: 20px;
          height: 20px;
          background: rgba(254, 51, 1, 0.1);
          animation: animate 25s linear infinite;
          bottom: -150px;
        }

        .circles li:nth-child(1) {
          left: 25%;
          width: 80px;
          height: 80px;
          animation-delay: 0s;
        }

        .circles li:nth-child(2) {
          left: 10%;
          width: 20px;
          height: 20px;
          animation-delay: 2s;
          animation-duration: 12s;
        }

        .circles li:nth-child(3) {
          left: 70%;
          width: 20px;
          height: 20px;
          animation-delay: 4s;
        }

        .circles li:nth-child(4) {
          left: 40%;
          width: 60px;
          height: 60px;
          animation-delay: 0s;
          animation-duration: 18s;
        }

        .circles li:nth-child(5) {
          left: 65%;
          width: 20px;
          height: 20px;
          animation-delay: 0s;
        }

        .circles li:nth-child(6) {
          left: 75%;
          width: 110px;
          height: 110px;
          animation-delay: 3s;
        }

        .circles li:nth-child(7) {
          left: 35%;
          width: 150px;
          height: 150px;
          animation-delay: 7s;
        }

        .circles li:nth-child(8) {
          left: 50%;
          width: 25px;
          height: 25px;
          animation-delay: 15s;
          animation-duration: 45s;
        }

        .circles li:nth-child(9) {
          left: 20%;
          width: 15px;
          height: 15px;
          animation-delay: 2s;
          animation-duration: 35s;
        }
  
        .circles li:nth-child(10) {
          left: 85%;
          width: 150px;
          height: 150px;
          animation-delay: 0s;
          animation-duration: 11s;
        }

        @keyframes animate {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
            border-radius: 0;
          }

          100% {
            transform: translateY(-1000px) rotate(720deg);
            opacity: 0;
            border-radius: 50%;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }

        /* Custom scrollbar styles */
        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: #FE3301;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #cc2901;
        }

        /* Add these styles to remove any potential divider lines */
        .divide-y > :not([hidden]) ~ :not([hidden]),
        .divide-x > :not([hidden]) ~ :not([hidden]) {
          --tw-divide-y-reverse: 0;
          --tw-divide-x-reverse: 0;
          border-top-width: 0;
          border-bottom-width: 0;
          border-left-width: 0;
          border-right-width: 0;
        }
      `}</style>
    </div>
  );
}
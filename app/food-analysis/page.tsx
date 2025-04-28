"use client";

import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import Image from "next/image";

export default function FoodAnalysis() {
  const [beforeImage, setBeforeImage] = useState<File | null>(null);
  const [afterImage, setAfterImage] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string>("");
  const [afterPreview, setAfterPreview] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        alert('File is too large. Please select an image under 5MB.');
        return;
      }
      console.log(`${type} image selected:`, file.name);
      if (type === 'before') {
        setBeforeImage(file);
        setBeforePreview(URL.createObjectURL(file));
      } else {
        setAfterImage(file);
        setAfterPreview(URL.createObjectURL(file));
      }
    }
  };

  const handleUploadClick = (type: 'before' | 'after') => {
    if (type === 'before') {
      beforeInputRef.current?.click();
    } else {
      afterInputRef.current?.click();
    }
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Extract just the base64 part without the data URL prefix
          const base64String = reader.result.split(',')[1];
          if (!base64String) {
            reject(new Error('Failed to convert file to base64'));
            return;
          }
          resolve(base64String);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAnalyze = async () => {
    if (!beforeImage || !afterImage) {
      alert('Please upload both before and after images');
      return;
    }

    try {
      setIsLoading(true);
      
      // Create FormData object
      const formData = new FormData();
      formData.append('beforeImage', beforeImage);
      formData.append('afterImage', afterImage);

      // Send to API
      const response = await fetch('/api/food-analysis', {
        method: 'POST',
        body: formData
      });

      const responseData = await response.json();

      // Handle the API response
      if (responseData.success && responseData.analysis) {
        // Set the analysis result directly from the text response
        setAnalysisResult(responseData.analysis);
      } else if (responseData.rawText) {
        // Fallback to rawText if available
        setAnalysisResult(responseData.rawText);
      } else {
        throw new Error(responseData.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Error analyzing images:', error);
      alert('Failed to analyze images. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to render the analysis result with the correct formatting
  const renderAnalysisResult = (result: string) => {
    if (result.includes('**Analysis Result:**')) {
      // Already in the right format, just render it
      const lines = result.split('\n').filter(line => line.trim() !== '');
      
      return (
        <div className="space-y-3">
          {lines.map((line, index) => {
            if (line.startsWith('**')) {
              // This is a header
              return <h3 key={index} className="font-semibold text-lg">{line.replace(/\*\*/g, '')}</h3>;
            } else if (line.startsWith('* ')) {
              // This is a bullet point
              return (
                <div key={index} className="flex">
                  <span className="mr-2">•</span>
                  <p>{line.substring(2).replace(/"/g, '')}</p>
                </div>
              );
            } else {
              // Regular text
              return <p key={index}>{line}</p>;
            }
          })}
        </div>
      );
    } else {
      // This might be in the old format - try to present it nicely
      return (
        <div className="whitespace-pre-line">
          {result}
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-[#FE3301] mb-6">Food Analysis</h1>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="space-y-4">
              {analysisResult && (
                <div className="bg-gray-50 p-6 rounded-lg mb-6">
                  {renderAnalysisResult(analysisResult)}
                </div>
              )}
            </div>

            {/* Before/After Image Upload Section */}
            <div className="mt-8 border-t pt-8">
              <h2 className="text-xl font-semibold mb-4">Before/After Comparison</h2>
              <p className="text-gray-600 mb-6">
                Upload photos of your meal before and after eating. We'll calculate the difference and
                identify what you consumed.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Before Eating Upload */}
                <div>
                  <h3 className="font-medium mb-2">Before Eating</h3>
                  <input
                    type="file"
                    ref={beforeInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'before')}
                  />
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-orange-300 transition-colors"
                    onClick={() => handleUploadClick('before')}
                  >
                    {beforePreview ? (
                      <div className="relative w-full h-48">
                        <Image
                          src={beforePreview}
                          alt="Before eating"
                          fill
                          className="object-cover rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center cursor-pointer">
                        <div className="p-3 rounded-full bg-gray-50">
                          <svg
                            className="w-6 h-6 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                            />
                          </svg>
                        </div>
                        <p className="mt-2 text-sm text-gray-500">Upload before photo</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* After Eating Upload */}
                <div>
                  <h3 className="font-medium mb-2">After Eating</h3>
                  <input
                    type="file"
                    ref={afterInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'after')}
                  />
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-orange-300 transition-colors"
                    onClick={() => handleUploadClick('after')}
                  >
                    {afterPreview ? (
                      <div className="relative w-full h-48">
                        <Image
                          src={afterPreview}
                          alt="After eating"
                          fill
                          className="object-cover rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center cursor-pointer">
                        <div className="p-3 rounded-full bg-gray-50">
                          <svg
                            className="w-6 h-6 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                            />
                          </svg>
                        </div>
                        <p className="mt-2 text-sm text-gray-500">Upload after photo</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Button 
                className="w-full mt-6 bg-[#FE3301] hover:bg-orange-700"
                onClick={handleAnalyze}
                disabled={isLoading || !beforeImage || !afterImage}
              >
                {isLoading ? 'Analyzing...' : 'Analyze Difference'}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
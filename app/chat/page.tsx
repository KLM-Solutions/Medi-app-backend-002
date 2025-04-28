"use client"

import { useChat } from 'ai/react';
import { useRef, useState, useEffect } from 'react';
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send, ThumbsUp, ThumbsDown, Activity, Pill, Plus, Check, RefreshCw, Volume2, Mic } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

const debug = {
  log: (message: string, data?: any) => {
    console.log(`[CHAT-DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, error: any) => {
    console.error(`[CHAT-ERROR] ${message}`, error);
  }
}; 

type PersonaConfig = {
  [key: string]: {
    icon: JSX.Element;
    color: string;
    shortName: string;
  }
};
  
const personaConfig: PersonaConfig = {
  general_med: {
    icon: <Activity className="h-4 w-4" />,
    color: '#FE3301',
    shortName: 'General'
  },
  glp1: {
    icon: <Pill className="h-4 w-4" />,
    color: '#00C48C',
    shortName: 'GLP-1'
  }
};

interface MessageContentProps {
  content: string;
}

const MessageContent = ({ content }: MessageContentProps) => {
  // Store citations and titles map
  const citations = new Map<string, string>();
  const titles = new Map<string, string>();
  
  // Extract citations and titles with improved regex
  content.split('\n').forEach(line => {
    // Match citation format: [1]: https://example.com
    const citationMatch = line.match(/\[(\d+)\]:\s*(https?:\/\/\S+)/);
    if (citationMatch) {
      citations.set(citationMatch[1], citationMatch[2].trim());
    }
    
    // Match title format: [Title]: https://example.com
    const titleMatch = line.match(/\[((?!\d+\])[^\]]+)\]:\s*(https?:\/\/\S+)/);
    if (titleMatch) {
      titles.set(titleMatch[1], titleMatch[2].trim());
    }
  });

  // Process the content to replace citations and titles
  const processContent = (text: string) => {
    // Remove citation/title definition lines
    const lines = text.split('\n').filter(line => 
      !line.match(/\[.*?\]:\s*https?:\/\/\S+/)
    );

    // Process each line
    return lines.map(line => {
      let processed = line;
      
      // Replace citations with markdown links
      citations.forEach((url, num) => {
        // Match [1] or [1,2] or [1,2,3] patterns
        const regex = new RegExp(`\\[(\\d+(?:,\\s*\\d+)*)\\]`, 'g');
        processed = processed.replace(regex, (match, nums) => {
          // Handle multiple citations
          const numbers = nums.split(',').map((n: string) => n.trim());
          return numbers.map((n: string) => {
            const citationUrl = citations.get(n);
            return citationUrl ? `[${n}](${citationUrl})` : `[${n}]`;
          }).join(', ');
        });
      });
      
      // Handle other formatting
      if (processed.startsWith('###')) {
        processed = processed.replace(/^###\s*(.*)$/, '# $1');
      }
      processed = processed.replace(/\*\*(.*?)\*\*/g, '**$1**');
      
      // Replace titles with markdown links
      titles.forEach((url, title) => {
        const regex = new RegExp(`\\[${title}\\]`, 'g');
        processed = processed.replace(regex, `[${title}](${url})`);
      });
      
      return processed;
    }).join('\n');
  };

  const processedContent = processContent(content);
  
  return (
    <div className="prose prose-sm max-w-none 
      prose-headings:font-bold prose-headings:text-gray-900 prose-headings:my-8 prose-headings:text-xl
      prose-p:text-gray-600 prose-p:leading-relaxed prose-p:my-6
      prose-strong:font-semibold prose-strong:text-gray-900 
      prose-a:text-[#FE3301] prose-a:no-underline hover:prose-a:underline hover:prose-a:text-[#FE3301]/80
      prose-code:bg-gray-100 prose-code:text-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded 
      prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-pre:p-6 prose-pre:rounded-lg prose-pre:my-8
      prose-ul:list-disc prose-ul:pl-6 prose-ul:my-6 prose-ul:space-y-4
      prose-ol:list-decimal prose-ol:pl-6 prose-ol:my-6 prose-ol:space-y-4
      prose-li:my-3 prose-li:leading-relaxed
      prose-blockquote:border-l-4 prose-blockquote:border-[#FE3301] prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:my-8"
    >
      <ReactMarkdown
        components={{
          a: ({ node, children, href, ...props }) => {
            const text = Array.isArray(children) ? children.join('') : children?.toString() || '';
            const isCitation = /^\d+$/.test(text); // Check if it's a citation number
            
            return (
              <a 
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center ${
                  isCitation ? 'text-[#FE3301] hover:text-[#FE3301]/80 text-sm align-super ml-0.5' : 
                  'text-[#FE3301] hover:text-[#FE3301]/80'
                }`}
                {...props}
              >
                {isCitation ? `[${text}]` : text}
              </a>
            );
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

const handleTextToSpeech = async (text: string) => {
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error('TTS request failed');
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
    };

    await audio.play();
  } catch (error) {
    console.error('TTS Error:', error);
    toast.error('Failed to convert text to speech');
  }
};

// Move all localStorage operations to a client-side utility
const ChatStorage = {
  getId: () => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem('currentChatId') || '';
    } catch (e) {
      return '';
    }
  },
  
  setId: (id: string) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('currentChatId', id);
    } catch (e) {
      console.error('Error setting chat ID:', e);
    }
  },
  
  getMessages: (chatId: string) => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(`chat-messages-${chatId}`);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Error loading chat messages:', e);
      return [];
    }
  },
  
  cleanup: (currentId: string) => {
    if (typeof window === 'undefined') return;
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('chat-') && !key.includes(currentId)) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.error('Error cleaning up storage:', e);
    }
  }
};

const handleNewChat = () => {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('chat-')) {
        localStorage.removeItem(key);
      }
    });
    window.location.reload();
  } catch (e) {
    console.error('Error creating new chat:', e);
    toast.error('Failed to create new chat');
  }
};

// Update persona change handler to maintain session
const handlePersonaChange = async (
  newPersona: string, 
  chatId: string, 
  setSelectedPersona: Function,
  setMessages: Function
) => {
  try {
    if (!newPersona || !['general_med', 'glp1'].includes(newPersona)) {
      throw new Error('Invalid persona selected');
    }
    
    localStorage.setItem(`chat-persona-${chatId}`, newPersona);
    setSelectedPersona(newPersona);
    // Remove message clearing
    // Keep existing messages in localStorage
  } catch (e) {
    console.error('Error changing persona:', e);
    toast.error('Failed to switch persona');
  }
};

export default function Chat() {
  // Initialize state with empty values
  const [chatId, setChatId] = useState('');
  
  // Initialize chat after mount
  useEffect(() => {
    const storedId = ChatStorage.getId();
    const newId = storedId || `chat-${Date.now()}`;
    setChatId(newId);
    ChatStorage.setId(newId);
    ChatStorage.cleanup(newId);
  }, []);

  const [selectedPersona, setSelectedPersona] = useState<string>('general_med');

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, reload, setMessages } = useChat({
    api: '/api/chat',
    id: chatId,
    initialMessages: [],
    body: {
      data: {
        persona: selectedPersona || 'general_med',
        includeHistory: true
      }
    },
    onResponse: (response) => {
      debug.log('Received response from API', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      const chatTitle = response.headers.get('X-Chat-Title');
      if (chatTitle) {
        setTitle(chatTitle);
        localStorage.setItem(`chat-title-${chatId}`, chatTitle);
      }
    },
    onFinish: (message) => {
      debug.log('Chat completion finished', { message });
      localStorage.setItem(`chat-messages-${chatId}`, JSON.stringify(messages));
      scrollToBottom('smooth');
    },
    onError: (error) => {
      debug.error('Chat completion error', error);
      toast.error('Failed to generate response. Please try again.');
    }
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(() => {
    if (typeof window === 'undefined') return 'Medication Assistant Discussion';
    try {
      return localStorage.getItem(`chat-title-${chatId}`) || 'Medication Assistant Discussion';
    } catch (e) {
      return 'Medication Assistant Discussion';
    }
  });
  const [showDetailedFeedback, setShowDetailedFeedback] = useState<string | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [userScrolled, setUserScrolled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    if (chatContainerRef.current) {
      const scrollHeight = chatContainerRef.current.scrollHeight;
      const currentHeight = chatContainerRef.current.clientHeight;
      
      // Only auto-scroll if user hasn't manually scrolled up
      if (!userScrolled) {
        chatContainerRef.current.scrollTo({
          top: scrollHeight,
          behavior
        });
      }
    }
  };

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const bottomThreshold = 100; // pixels from bottom
      const isAtBottom = scrollHeight - (scrollTop + clientHeight) < bottomThreshold;
      
      setIsNearBottom(isAtBottom);
      setUserScrolled(!isAtBottom); // Only consider it user-scrolled if not at bottom
    }
  };

  // Modified scroll behavior during streaming
  useEffect(() => {
    if (isLoading) {
      const scrollInterval = setInterval(() => {
        if (chatContainerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
          const isAtBottom = scrollHeight - (scrollTop + clientHeight) < 100;
          
          if (!userScrolled || isAtBottom) {
            scrollToBottom('auto');
          }
        }
      }, 100);

      return () => clearInterval(scrollInterval);
    }
  }, [isLoading, userScrolled]);

  // Reset userScrolled when a new message is added
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        scrollToBottom('smooth');
        setUserScrolled(false);
      }
    }
  }, [messages.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (title) {
        localStorage.setItem(`chat-title-${chatId}`, title);
      }
    } catch (e) {
      console.error('Error saving chat title:', e);
    }
  }, [title, chatId]);

  const handleFeedback = async (messageId: string, value: number) => {
    debug.log('Submitting feedback', { messageId, value });

    if (value === 0) {
      setShowDetailedFeedback(messageId);
      return;
    }

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          feedback: value,
          messageContent: messages.find(m => m.id === messageId)?.content || '',
          timestamp: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to store feedback');
      }

      toast.success('Feedback saved');
    } catch (error) {
      debug.error('Error storing feedback', error);
      toast.error('Failed to save feedback');
    }
  };

  const customHandleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    debug.log('Submitting message', {
      persona: selectedPersona,
      inputLength: input.length,
      messageCount: messages.length
    });

    try {
      await handleSubmit(e, {
        data: {
          persona: selectedPersona,
          includeHistory: true
        }
      });
    } catch (error) {
      debug.error('Error submitting message', error);
      toast.error('Failed to send message. Please try again.');
    }
  };

  const handleSpeechToText = async () => {
    if (isRecording) {
      setIsRecording(false);
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false 
      });
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp3';
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        const formData = new FormData();
        formData.append('audio', audioBlob);

        try {
          const response = await fetch('/api/stt', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('STT request failed');
          }

          const { text } = await response.json();
          if (text) {
            const syntheticEvent = {
              target: { value: text }
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        } catch (error) {
          console.error('STT Error:', error);
          toast.error('Failed to convert speech to text');
        } finally {
          stream.getTracks().forEach(track => track.stop());
        }
      };

    } catch (error) {
      console.error('Microphone Error:', error);
      toast.error('Failed to access microphone');
    }
  };

  if (error) {
    debug.error('Chat error state', error);
  }

  return (
    <div className="min-h-screen bg-gradient-to-t from-[#FFF5F2] via-[#FFF9F7] to-white overflow-hidden">
      <Header />
      <main className="container mx-auto px-4 py-8 h-[calc(100vh-4rem)] overflow-hidden">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-center text-[#FE3301]">
            Medication Assistant
          </h1>
        </div>
        
        <Card className="max-w-4xl mx-auto bg-white/80 backdrop-blur-sm shadow-lg h-[calc(100%-4rem)] overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-[#FE3301]">
              <MessageCircle className="h-6 w-6" />
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 flex flex-col h-[calc(100%-4rem)] relative overflow-hidden">
            <div 
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto mb-4 chat-container scroll-smooth"
              style={{ 
                scrollBehavior: 'smooth',
                minHeight: '200px'
              }}
              onScroll={handleScroll}
            >
              <div className="flex flex-col space-y-4 transition-all duration-300">
                {messages.length === 0 && !isLoading && (
                  <div className="text-center text-gray-500 mt-8">
                    <p>Start a conversation by typing a message below.</p>
                  </div>
                )}
                
                {messages.map((message) => (
                  <div 
                    key={message.id} 
                    className="message-wrapper transition-all duration-200"
                  >
                    <div className="text-sm text-gray-600 mb-1">
                      {message.role === 'user' ? 'You' : 'AI Assistant'}
                    </div>
                    <div className={`rounded-lg p-4 transition-all duration-200 ${
                      message.role === 'user' 
                        ? 'bg-gradient-to-r from-[#FFE5E0] to-[#FFE9E5] border border-[#FE330125]' 
                        : 'bg-white border border-gray-100'
                    }`}>
                      <MessageContent content={message.content} />
                    </div>
                    <div className="flex items-center justify-between mt-1 mb-2">
                      <div className="text-xs text-gray-500">
                        {new Date().toLocaleTimeString()}
                      </div>
                      {message.role === 'assistant' && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFeedback(message.id, 1)}
                            className="p-2 hover:bg-green-100"
                          >
                            <ThumbsUp className="h-4 w-4 text-gray-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFeedback(message.id, 0)}
                            className="p-2 hover:bg-red-100"
                          >
                            <ThumbsDown className="h-4 w-4 text-gray-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTextToSpeech(message.content)}
                            className="p-2 hover:bg-blue-100"
                          >
                            <Volume2 className="h-4 w-4 text-gray-500" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="bg-white border border-gray-100 rounded-lg p-4 mb-4 transition-all duration-200">
                    <div className="flex space-x-2 justify-center items-center h-6">
                      <span className="sr-only">Loading...</span>
                      <div className="h-2 w-2 bg-[#FE3301] rounded-full animate-bounce"></div>
                      <div className="h-2 w-2 bg-[#FE3301] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="h-2 w-2 bg-[#FE3301] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-px" />
              </div>
            </div>

            {!isNearBottom && !isLoading && (
              <button
                onClick={() => scrollToBottom('smooth')}
                className="absolute bottom-20 right-4 bg-white shadow-lg rounded-full p-2 hover:bg-gray-100 transition-opacity duration-200"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            )}

            <form onSubmit={customHandleSubmit} className="flex gap-3 mt-auto bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
              {/* Desktop View - Always visible, hidden on mobile */}
              <div className="hidden sm:flex flex-1 items-center gap-3">
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    onClick={handleNewChat}
                    className="h-10 px-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-md transition-colors flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">New</span>
                  </Button>

                  <Select 
                    value={selectedPersona} 
                    onValueChange={(value) => handlePersonaChange(value, chatId, setSelectedPersona, setMessages)}
                    defaultValue="general_med"
                  >
                    <SelectTrigger className="h-10 w-10 p-0 border-none bg-gray-50 hover:bg-gray-100 rounded-md flex items-center justify-center transition-colors">
                      {selectedPersona ? (
                        <div style={{ color: personaConfig[selectedPersona].color }}>
                          {personaConfig[selectedPersona].icon}
                        </div>
                      ) : (
                        <Activity className="h-4 w-4 text-gray-400" />
                      )} 
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general_med">General Medical</SelectItem>
                      <SelectItem value="glp1">GLP-1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <textarea
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        customHandleSubmit(e);
                      }
                    }}
                    placeholder="Type your message..."
                    className="w-full min-h-[40px] max-h-[120px] bg-gray-50 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#FE3301]/20 resize-none border border-gray-200 focus:border-[#FE3301] text-sm placeholder:text-gray-500"
                    style={{
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none'
                    }}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    onClick={handleSpeechToText}
                    className={`h-10 w-10 rounded-md flex items-center justify-center transition-colors ${
                      isRecording 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>

                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="bg-[#FE3301] text-white hover:bg-[#FE3301]/90 h-10 w-10 rounded-md flex items-center justify-center transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Mobile View - Hidden on desktop */}
              <div className="flex flex-col gap-2 w-full sm:hidden">
                <div className="flex items-center gap-2 px-2">
                  <Button
                    type="button"
                    onClick={handleNewChat}
                    className="h-9 px-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-md transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">New</span>
                  </Button>

                  <Select 
                    value={selectedPersona} 
                    onValueChange={(value) => handlePersonaChange(value, chatId, setSelectedPersona, setMessages)}
                    defaultValue="general_med"
                  >
                    <SelectTrigger className="h-9 w-9 p-0 border-none bg-gray-50 hover:bg-gray-100 rounded-md flex items-center justify-center transition-colors">
                      {selectedPersona ? (
                        <div style={{ color: personaConfig[selectedPersona].color }}>
                          {personaConfig[selectedPersona].icon}
                        </div>
                      ) : (
                        <Activity className="h-3.5 w-3.5 text-gray-400" />
                      )} 
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general_med">General Medical</SelectItem>
                      <SelectItem value="glp1">GLP-1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 px-2">
                  <textarea
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        customHandleSubmit(e);
                      }
                    }}
                    placeholder="Type your message..."
                    className="flex-1 min-h-[36px] max-h-[120px] bg-gray-50 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FE3301]/20 resize-none border border-gray-200 focus:border-[#FE3301] text-sm placeholder:text-gray-500"
                    style={{
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none'
                    }}
                  />
                  
                  <Button
                    type="button"
                    onClick={handleSpeechToText}
                    className={`h-9 w-9 rounded-md flex items-center justify-center transition-colors ${
                      isRecording 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <Mic className="h-3.5 w-3.5" />
                  </Button>

                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="bg-[#FE3301] text-white hover:bg-[#FE3301]/90 h-9 w-9 rounded-md flex items-center justify-center transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>

      <style jsx global>{`
        body {
          overflow: hidden;
        }

        .chat-container {
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
        }

        .chat-container::-webkit-scrollbar {
          width: 8px;
        }

        .chat-container::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }

        .chat-container::-webkit-scrollbar-thumb {
          background: #FE3301;
          border-radius: 4px;
          transition: background-color 0.3s ease;
        }

        .chat-container::-webkit-scrollbar-thumb:hover {
          background: #cc2901;
        }

        .message-wrapper {
          transition: all 0.3s ease;
        }
      `}</style>
    </div>
  );
}


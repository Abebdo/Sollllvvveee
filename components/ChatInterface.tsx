import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RefreshCw, StopCircle } from 'lucide-react';
import { Message, ModelType } from '../types';
import { createChatSession, streamMessage } from '../services/geminiService';
import { Chat } from '@google/genai';

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Hello! I'm Nova. I'm running on the **Gemini 3 Flash** model. How can I assist you today?",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize chat session on mount
  useEffect(() => {
    const session = createChatSession(ModelType.FLASH);
    setChatSession(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !chatSession || isLoading) return;

    const userMsgText = inputText.trim();
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userMsgText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputText('');
    setIsLoading(true);
    
    // Reset textarea height
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }

    // Placeholder for model message
    const modelMsgId = (Date.now() + 1).toString();
    const newModelMsg: Message = {
      id: modelMsgId,
      role: 'model',
      text: '', // Starts empty
      timestamp: new Date(),
      isStreaming: true
    };
    
    setMessages(prev => [...prev, newModelMsg]);

    try {
      await streamMessage(chatSession, userMsgText, (chunk) => {
        setMessages(prev => prev.map(msg => 
          msg.id === modelMsgId 
            ? { ...msg, text: msg.text + chunk }
            : msg
        ));
      });
      
      setMessages(prev => prev.map(msg => 
        msg.id === modelMsgId ? { ...msg, isStreaming: false } : msg
      ));
      
    } catch (error) {
      setMessages(prev => prev.map(msg => 
        msg.id === modelMsgId 
          ? { ...msg, text: "**Error:** Failed to generate response. Please try again.", isStreaming: false } 
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const handleInputResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputText(e.target.value);
      e.target.style.height = 'auto';
      e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  }

  return (
    <div className="flex flex-col h-full bg-background relative animate-fade-in">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 pb-32">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex items-start gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1
              ${msg.role === 'model' ? 'bg-gradient-to-tr from-blue-500 to-purple-600' : 'bg-slate-700'}
            `}>
              {msg.role === 'model' ? <Bot size={18} className="text-white" /> : <User size={18} className="text-slate-300" />}
            </div>
            
            <div className={`
              flex flex-col max-w-[85%] lg:max-w-[75%]
              ${msg.role === 'user' ? 'items-end' : 'items-start'}
            `}>
              <div className={`
                px-5 py-3.5 rounded-2xl shadow-md text-sm lg:text-base leading-relaxed whitespace-pre-wrap
                ${msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-surface border border-slate-700 text-slate-200 rounded-tl-none'
                }
              `}>
                {msg.text}
                {msg.isStreaming && (
                   <span className="inline-block w-2 h-4 ml-1 bg-blue-400 animate-pulse align-middle"></span>
                )}
              </div>
              <span className="text-xs text-slate-500 mt-1 px-1">
                {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t border-slate-700/50 p-4">
        <div className="max-w-4xl mx-auto relative">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleInputResize}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={isLoading}
            rows={1}
            className="w-full bg-surface border border-slate-700 text-slate-100 rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none overflow-hidden min-h-[56px]"
          />
          <button
            onClick={isLoading ? undefined : handleSendMessage}
            disabled={!inputText.trim() && !isLoading}
            className={`
              absolute right-2 bottom-2 p-2.5 rounded-xl transition-all duration-200
              ${inputText.trim() || isLoading
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }
            `}
          >
            {isLoading ? <RefreshCw size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
        <div className="text-center mt-2">
            <p className="text-xs text-slate-500">
                Nova may display inaccurate info, including about people, so double-check its responses.
            </p>
        </div>
      </div>
    </div>
  );
};
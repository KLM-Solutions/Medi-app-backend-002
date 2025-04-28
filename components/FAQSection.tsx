import React from 'react';
import { Card } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

const FAQCard: React.FC<{ question: string; answer: string }> = ({ question, answer }) => (
  <Card className="relative overflow-hidden border-gray-200 hover:shadow-lg transition-all duration-300 group">
    <div className="p-6 bg-white">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-[#FE3301]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#FE3301]/20 transition-colors">
          <HelpCircle size={28} className="text-[#FE3301]" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-black mb-2">{question}</h3>
          <p className="text-gray-700">{answer}</p>
        </div>
      </div>
    </div>
  </Card>
);

const FAQSection: React.FC = () => {
  const faqs = [
    {
      question: "What should I do if I miss a dose of my medication?",
      answer: "If you miss a dose, take it as soon as you remember. However, if it is close to the time for your next dose, skip the missed dose and continue with your regular schedule. Do not double up doses to make up for a missed one. If you're unsure, consult your healthcare provider or pharmacist." },
    {
      question: "Can I take my medication with food?",
      answer: "Some medications can be taken with food to reduce stomach irritation, while others should be taken on an empty stomach for better absorption. Check the instructions on your prescription label or consult your pharmacist to understand the best way to take your medication."},
    {
      question: "What are the common side effects of my medication?",
      answer: "Side effects vary by medication. Common ones may include nausea, headache, dizziness, or fatigue. For a complete list, refer to the medication leaflet or ask your pharmacist. If you experience severe or unexpected side effects, contact your doctor immediately." },
    {
      question: "How should I store my medication?",
      answer: "Most medications should be stored in a cool, dry place away from direct sunlight and out of reach of children and pets. Some medications may require refrigeration. Always follow the storage instructions provided on the label or packaging."}
  ];

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-[#FE3301] text-3xl md:text-4xl font-bold mb-12 text-center font-sans">
          Frequently Asked Questions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {faqs.map((faq, index) => (
            <FAQCard key={index} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
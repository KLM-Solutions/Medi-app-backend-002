import React from 'react';
import { MessageSquare, LayoutDashboard, Pill, Info } from "lucide-react";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => (
  <div className="group relative cursor-pointer overflow-hidden bg-white px-6 pt-10 pb-8 shadow-xl ring-1 ring-gray-900/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:rounded-lg">
    <span className="absolute top-10 z-0 h-20 w-20 rounded-full bg-[#FE3301] transition-all duration-300 group-hover:scale-[10]"></span>
    <div className="relative z-10 mx-auto">
      <span className="grid h-20 w-20 place-items-center rounded-full bg-[#FE3301] transition-all duration-300 group-hover:bg-[#FE3301]/90">
        {React.cloneElement(icon as React.ReactElement, { className: "h-10 w-10 text-white transition-all" })}
      </span>
      <div className="space-y-6 pt-5 text-base leading-7 text-black transition-all duration-300 group-hover:text-white/90">
        <h3 className="text-xl font-bold">{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  </div>
);

const FeaturesSection: React.FC = () => {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-[#FE3301] text-3xl md:text-4xl font-bold mb-12 text-center font-sans">
          Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          <FeatureCard
            icon={<MessageSquare size={32} />}
            title="Expert Information"
            description="Get instant answers to your questions about all medications from our AI assistant."
          />
          <FeatureCard
            icon={<LayoutDashboard size={32} />}
            title="Treatment Guidance"
            description="Learn about treatment options and management strategies for your problems and get appropriate treatment."
          />
          <FeatureCard
            icon={<Pill size={32} />}
            title="Medication Management"
            description="Understand dosing, administration, and monitoring of your health conditions."
          />
          <FeatureCard
            icon={<Info size={32} />}
            title="Call to Action"
            description="Get started today with Common Medication Assistant and simplify your medication management!"
          />
          
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;

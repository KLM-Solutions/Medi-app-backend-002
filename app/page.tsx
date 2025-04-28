"use client";
import Aboutus from "@/components/Aboutus";
import ContactSection from "@/components/ContactSection";
import FAQSection from "@/components/FAQSection";
import FeaturesSection from "@/components/FeaturesSection";
import Footer from "@/components/Footer";
import { Header } from "@/components/Header";
import Section1 from "@/components/Section1";
import Image from "next/image";

export default function Home() {
  return (
    <>
    <Header />
    <Section1 isSignedIn={false} onSignIn={() => {}} />
    <FeaturesSection />
    <FAQSection />
    <Footer />
    </>
  );
}
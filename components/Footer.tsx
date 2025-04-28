"use client";

import React from 'react';
import Link from 'next/link';
import { Twitter, Linkedin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-white text-gray-600 py-8">
      <div className="container mx-auto flex flex-col">
        <div className="flex justify-center mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-16 md:gap-24">
            <div>
              <h3 className="text-[#FE3301] font-semibold mb-4">Product</h3>
              <ul className="space-y-2">
                <li><Link href="/features" className="hover:text-[#FE3301]">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-[#FE3301]">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-[#FE3301] font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><Link href="/about" className="hover:text-[#FE3301]">About</Link></li>
                <li><Link href="/contact" className="hover:text-[#FE3301]">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-[#FE3301] font-semibold mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><Link href="/blog" className="hover:text-[#FE3301]">Blog</Link></li>
                <li><Link href="/faq" className="hover:text-[#FE3301]">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-[#FE3301] font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><Link href="/privacy" className="hover:text-[#FE3301]">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-[#FE3301]">Terms</Link></li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Copyright and Social Links */}
        <div className="flex justify-between items-center pt-8 border-t border-gray-200 px-4">
          <p className="text-sm text-gray-600">
            © 2024 GLP-1 Assistant. All rights reserved.
          </p>
          <div className="flex gap-4">
            <Link href="https://twitter.com" className="text-gray-600 hover:text-[#FE3301]">
              <Twitter size={20} />
            </Link>
            <Link href="https://linkedin.com" className="text-gray-600 hover:text-[#FE3301]">
              <Linkedin size={20} />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

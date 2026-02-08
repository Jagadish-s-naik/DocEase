import Link from 'next/link';
import { FileText, CheckCircle, Globe, Shield, Zap, Users } from 'lucide-react';
import { APP_NAME } from '@/config/constants';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-primary-600" />
              <span className="ml-2 text-2xl font-bold text-gray-900">{APP_NAME}</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/auth" className="text-gray-700 hover:text-primary-600">
                Login
              </Link>
              <Link href="/auth" className="btn-primary">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-primary-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Understand Any Document <br />
            <span className="text-primary-600">In Simple Language</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto accessible-text">
            Upload government, bank, legal, or insurance documents.
            Get clear explanations in your language. No jargon. No confusion.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/dashboard" className="btn-primary text-lg px-8 py-4">
              Upload Your Document
            </Link>
            <Link href="#how-it-works" className="btn-secondary text-lg px-8 py-4">
              How It Works
            </Link>
          </div>
          <p className="mt-6 text-gray-500">
            Free: 3 documents/month • No credit card required
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose {APP_NAME}?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Zap className="h-12 w-12 text-primary-600" />}
              title="Fast & Accurate"
              description="AI-powered OCR extracts text from any document. Get explanations in seconds."
            />
            <FeatureCard
              icon={<Globe className="h-12 w-12 text-primary-600" />}
              title="6 Languages"
              description="English, Hindi, Tamil, Telugu, Kannada, Marathi. Understand in your language."
            />
            <FeatureCard
              icon={<Shield className="h-12 w-12 text-primary-600" />}
              title="100% Private & Secure"
              description="Your documents are encrypted. Auto-deleted based on your preference."
            />
            <FeatureCard
              icon={<CheckCircle className="h-12 w-12 text-primary-600" />}
              title="Action Required?"
              description="We tell you exactly what you need to do, by when, and what happens if you don't."
            />
            <FeatureCard
              icon={<Users className="h-12 w-12 text-primary-600" />}
              title="Made for Common People"
              description="Large fonts, simple words, screen reader friendly. Everyone can understand."
            />
            <FeatureCard
              icon={<FileText className="h-12 w-12 text-primary-600" />}
              title="All Document Types"
              description="Government notices, bank letters, legal notices, insurance, loans, academic."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50" id="how-it-works">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="space-y-8">
            <Step number={1} title="Upload Your Document" description="PDF, JPG, PNG - even WhatsApp screenshots. Up to 10MB, 50 pages." />
            <Step number={2} title="AI Reads & Understands" description="We extract text, detect the document type, and analyze what it means." />
            <Step number={3} title="Get Simple Explanation" description="Clear sections: What is this? What to do? Deadlines? Money? Risks?" />
            <Step number={4} title="Translate & Share" description="Switch languages instantly. Download PDF or share via WhatsApp/Email." />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20" id="pricing">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Simple Pricing</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <PricingCard
              name="Free"
              price="₹0"
              period="forever"
              features={[
                '3 documents per month',
                'All languages',
                'Basic explanations',
                'No history',
              ]}
              cta="Start Free"
              ctaLink="/auth/signup"
            />
            <PricingCard
              name="Premium"
              price="₹99"
              period="per month"
              features={[
                'Unlimited documents',
                'All languages',
                'Detailed explanations',
                'Full history & search',
                'Download PDFs',
                'Priority support',
              ]}
              cta="Upgrade Now"
              ctaLink="/pricing"
              highlighted
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold mb-4">{APP_NAME}</h3>
              <p className="text-gray-400 text-sm">
                Making documents understandable for everyone.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="#features">Features</Link></li>
                <li><Link href="#pricing">Pricing</Link></li>
                <li><Link href="/dashboard">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/privacy">Privacy Policy</Link></li>
                <li><Link href="/terms">Terms of Service</Link></li>
                <li><Link href="/disclaimer">Disclaimer</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>support@docease.com</li>
                <li>Made in India 🇮🇳</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
            © 2026 {APP_NAME}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="card text-center">
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600 accessible-text">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-6">
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-xl">
        {number}
      </div>
      <div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-gray-600 accessible-text">{description}</p>
      </div>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  features,
  cta,
  ctaLink,
  highlighted = false,
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  ctaLink: string;
  highlighted?: boolean;
}) {
  return (
    <div className={`card ${highlighted ? 'ring-2 ring-primary-600' : ''}`}>
      {highlighted && (
        <div className="absolute top-0 right-0 bg-primary-600 text-white px-4 py-1 text-sm font-semibold rounded-bl-lg rounded-tr-xl">
          Popular
        </div>
      )}
      <h3 className="text-2xl font-bold mb-2">{name}</h3>
      <div className="mb-6">
        <span className="text-4xl font-bold">{price}</span>
        <span className="text-gray-600">/{period}</span>
      </div>
      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2 accessible-text">
            <CheckCircle className="h-5 w-5 text-success-600 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
      <Link
        href={ctaLink}
        className={highlighted ? 'btn-primary w-full text-center block' : 'btn-secondary w-full text-center block'}
      >
        {cta}
      </Link>
    </div>
  );
}

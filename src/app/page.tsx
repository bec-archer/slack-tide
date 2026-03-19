/**
 * Hey Stefan — this is still a work in progress and just something
 * conceptual to showcase the idea. Cheers!
 * -Bec
 */

import Link from 'next/link'

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent-glow blur-[120px] opacity-30" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent-glow blur-[120px] opacity-20" />
      </div>

      {/* Hero Section */}
      <section className="relative max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
          {/* Text Column */}
          <div className="flex-1 text-center md:text-left">
            <div className="badge badge-accent mb-6 inline-flex">
              <span className="text-xs font-medium tracking-wide uppercase">Now Available in All 50 States</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.1] tracking-tight mb-6">
              Your stuff.{' '}
              <span className="text-gradient-accent">Your history.</span>{' '}
              Your proof.
            </h1>

            <p className="text-text-secondary text-lg md:text-xl leading-relaxed mb-8 max-w-xl">
              QRSTKR combines state-shaped QR stickers with a powerful tracking platform. Log maintenance, prove ownership history, and add real value when you sell — all from a single scan.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Link href="/auth" className="btn-primary text-center">
                Order Your Sticker
              </Link>
              <a href="#how-it-works" className="btn-secondary text-center">
                See How It Works
              </a>
            </div>
          </div>

          {/* Visual Column */}
          <div className="flex-shrink-0 relative">
            <div className="w-48 h-48 md:w-64 md:h-64 relative animate-float">
              {/* Glow behind sticker */}
              <div className="absolute inset-0 bg-accent-glow rounded-full blur-3xl scale-125" />
              {/* Placeholder for sticker image */}
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src="/florida-sticker.png"
                  alt="Florida state-shaped QR sticker with circular QR code and halo design"
                  className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(45,212,191,0.3)]"
                />
              </div>
              <p className="text-center mt-3 text-text-tertiary text-xs font-medium tracking-wide uppercase">Florida &bull; Fort Myers</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <p className="text-accent text-sm font-semibold tracking-wider uppercase mb-3">How It Works</p>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">Three steps to tracked ownership</h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            From sticker to sale, QRSTKR follows your stuff through its entire lifecycle.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              step: '1',
              title: 'Order your sticker',
              desc: 'Pick your state, enter your city, and we\'ll ship you a weatherproof vinyl sticker with a unique QR code and bullseye marking your location.',
              icon: '📦',
            },
            {
              step: '2',
              title: 'Stick it & register',
              desc: 'Apply the sticker to your truck, boat, mower, or trailer. Scan it with your phone to claim it and enter the details.',
              icon: '📱',
            },
            {
              step: '3',
              title: 'Track everything',
              desc: 'Log oil changes, repairs, and upgrades. Shops can submit records directly. When you sell, buyers see the full verified history.',
              icon: '📋',
            },
          ].map((item) => (
            <div key={item.step} className="card-static p-8 text-center group">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent-muted text-accent font-bold text-sm mb-5 border border-border-default">
                {item.step}
              </div>
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-bold mb-3 text-text-primary">{item.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <p className="text-accent text-sm font-semibold tracking-wider uppercase mb-3">Features</p>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">More than a sticker</h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            QRSTKR is the platform that makes your maintenance history worth something.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              title: 'Shop-Verified Records',
              desc: 'When a shop services your item, they can log it directly. These records carry more weight than self-reported entries.',
              icon: '🔧',
            },
            {
              title: 'AI Assistant',
              desc: "Ask questions about your specific vehicle. 'What oil does my truck take?' gets an answer for YOUR truck, not a generic one.",
              icon: '✨',
            },
            {
              title: 'Ownership Transfer',
              desc: 'When you sell, transfer ownership with a tap. The buyer gets the full history. The sticker stays on and keeps working.',
              icon: '🤝',
            },
            {
              title: 'Built-In Marketplace',
              desc: 'List your item for sale right in the app. Buyers can scan the sticker and see everything before they buy.',
              icon: '🏪',
            },
          ].map((feature) => (
            <div key={feature.title} className="card p-8">
              <div className="text-3xl mb-4">{feature.icon}</div>
              <h3 className="text-lg font-bold mb-3 text-text-primary">{feature.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative max-w-3xl mx-auto px-6 py-20">
        <div className="card-static p-10 md:p-14 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">Start tracking today</h2>
          <p className="text-text-secondary text-lg mb-8 max-w-lg mx-auto">
            Every sticker includes one year of platform access. Track maintenance, use the AI assistant, and list on the marketplace — all included.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 justify-items-center mb-8 text-sm text-text-secondary max-w-md mx-auto">
            {[
              'Weatherproof vinyl sticker',
              'Unlimited maintenance records',
              'AI assistant access',
              'Marketplace listing',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <CheckIcon />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <Link href="/auth" className="btn-primary text-lg">
            Order Your Sticker
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-8">
        <p className="text-center text-text-tertiary text-sm">
          QRSTKR &bull; A Hydraulics SR-80 project &bull; &copy; 2026
        </p>
      </footer>
    </div>
  )
}

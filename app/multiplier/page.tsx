import { Wand2, ArrowRight, Layers, Search, Target, Maximize, Shield } from 'lucide-react';
import { MultiplierTool } from '@/components/multiplier-tool';
import Link from 'next/link';

const steps = [
  { icon: Search, label: 'Extract', desc: 'Parse scene elements' },
  { icon: Layers, label: 'Select', desc: 'Choose architecture' },
  { icon: Target, label: 'Map', desc: 'Timeline beats' },
  { icon: Maximize, label: 'Amplify', desc: 'Cinematic detail' },
  { icon: Shield, label: 'Guard', desc: 'Quality check' },
];

export default function MultiplierPage() {
  return (
    <div className="hero-gradient">
      <section className="pt-12 pb-6 px-4">
        <div className="mx-auto max-w-[900px] text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-1.5 text-sm text-blue-400 mb-4">
            <Wand2 className="h-3.5 w-3.5" /> LLM
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Prompt <span className="text-blue-400">Multiplier</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto mb-6">
            Transform weak scene descriptions into cinematic, optimized video prompts.
          </p>

          <div className="flex items-center justify-center gap-4 text-sm mb-8">
            <Link href="/multiplier/history" className="text-muted-foreground hover:text-foreground transition-colors">
              View History
            </Link>
            <span className="text-border">|</span>
            <Link href="/multiplier/catalogue" className="text-muted-foreground hover:text-foreground transition-colors">
              Video Catalogue
            </Link>
          </div>
        </div>
      </section>

      <section className="pb-16 px-4">
        <div className="mx-auto max-w-[900px]">
          <MultiplierTool />
        </div>
      </section>
    </div>
  );
}

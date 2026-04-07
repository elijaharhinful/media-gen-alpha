import { BookOpen, Film } from 'lucide-react';
import { CatalogueClient } from '@/components/catalogue-client';
import Link from 'next/link';

export default function MultiplierCataloguePage() {
  return (
    <div className="hero-gradient">
      <section className="pt-12 pb-6 px-4">
        <div className="mx-auto max-w-[1100px] text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-1.5 text-sm text-blue-400 mb-4">
            <BookOpen className="h-3.5 w-3.5" /> Video Catalogue
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight mb-3">
            Video Prompt <span className="text-blue-400">Examples</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto mb-4">
            Curated collection of high-performing AI videos with prompt analysis.
          </p>
          <Link href="/multiplier" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Multiplier
          </Link>
        </div>
      </section>
      <section className="pb-16 px-4">
        <div className="mx-auto max-w-[1100px]">
          <CatalogueClient />
        </div>
      </section>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { ImageIcon, Film, Wand2, Sparkles, ArrowRight, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const tools = [
  {
    href: '/image-generator',
    title: 'Image Generator',
    subtitle: 'AI Powered',
    description: 'Generate photorealistic images from text prompts with advanced AI.',
    icon: ImageIcon,
    accent: 'from-lime-400 to-green-500',
    accentText: 'text-lime-400',
    accentBg: 'bg-lime-400/10 border-lime-400/20',
    glow: 'group-hover:shadow-lime-400/20',
  },
  {
    href: '/video-generator',
    title: 'Video Generator',
    subtitle: 'AI Powered',
    description: 'Create cinematic 5-second videos with reference images and professional prompts.',
    icon: Film,
    accent: 'from-purple-400 to-violet-500',
    accentText: 'text-purple-400',
    accentBg: 'bg-purple-400/10 border-purple-400/20',
    glow: 'group-hover:shadow-purple-400/20',
  },
  {
    href: '/multiplier',
    title: 'Prompt Multiplier',
    subtitle: '5-Step Framework',
    description: 'Transform weak scene descriptions into optimized video prompts with the Multiplier engine.',
    icon: Wand2,
    accent: 'from-blue-400 to-cyan-500',
    accentText: 'text-blue-400',
    accentBg: 'bg-blue-400/10 border-blue-400/20',
    glow: 'group-hover:shadow-blue-400/20',
  },
];

export default function HomePage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="hero-gradient">
      {/* Hero */}
      <section className="pt-16 pb-8 px-4">
        <div className="mx-auto max-w-[1000px] text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-1.5 text-sm text-muted-foreground mb-6">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Movie Gen Alpha
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
              Create with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-400 via-blue-400 to-purple-400">
                AI Power
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
              Three professional tools for image generation, video creation, and prompt engineering — all in one creative workspace.
            </p>
            {session?.user?.name && (
              <p className="text-sm text-muted-foreground">
                Welcome back, <span className="text-foreground font-medium">{session.user.name}</span>
              </p>
            )}
          </motion.div>
        </div>
      </section>

      {/* Tool Cards */}
      <section className="pb-20 px-4">
        <div className="mx-auto max-w-[1100px] grid grid-cols-1 md:grid-cols-3 gap-6">
          {tools.map((tool, i) => (
            <motion.div
              key={tool.href}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 * i, duration: 0.5 }}
            >
              <Link href={tool.href} className="group block">
                <div className={`relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-8 transition-all duration-300 hover:border-border hover:shadow-lg ${tool.glow}`}>
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${tool.accent} mb-6`}>
                    <tool.icon className="h-7 w-7 text-white" />
                  </div>

                  <div className={`inline-flex items-center gap-1.5 rounded-full ${tool.accentBg} border px-2.5 py-0.5 text-xs font-medium ${tool.accentText} mb-3`}>
                    <Zap className="h-3 w-3" />
                    {tool.subtitle}
                  </div>

                  <h2 className="font-display text-xl font-bold mb-2">{tool.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">{tool.description}</p>

                  <div className={`flex items-center gap-2 text-sm font-medium ${tool.accentText} group-hover:gap-3 transition-all`}>
                    Open Tool
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

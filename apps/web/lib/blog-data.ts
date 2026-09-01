export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  keyword: string;
  date: string;
  dek: string;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "livekit-pivoted-to-ai-agents",
    title: "LiveKit pivoted to AI agents. Lumyx didn't.",
    description:
      "LiveKit raised $100M to become an AI agent platform. Here's what that means if you're building a video product, not a voice bot.",
    keyword: "livekit ai agents",
    date: "2026-09-01",
    dek: "A look at where LiveKit's funding, product and content are actually pointed in 2026 — and what that leaves open for people who just want to ship video.",
  },
];

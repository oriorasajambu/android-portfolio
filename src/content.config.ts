import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const nonEmpty = z.string().trim().min(1);

/** Single profile record — the source for hero, timeline, contact and the public CV. */
const profile = defineCollection({
  loader: file('src/content/profile.json'),
  schema: z.object({
    name: nonEmpty,
    title: nonEmpty,
    summary: nonEmpty,
    tagline: nonEmpty,
    email: z.email(),
    cv: z.object({ href: z.string().regex(/^[\w./-]+\.pdf$/), label: nonEmpty }),
    links: z.array(z.object({ label: nonEmpty, href: z.url() })),
    languages: z.array(nonEmpty).min(1),
    experience: z
      .array(
        z.object({
          role: nonEmpty,
          org: nonEmpty,
          period: nonEmpty,
          summary: nonEmpty,
          highlights: z.array(nonEmpty),
        }),
      )
      .min(1),
    education: z.array(z.object({ title: nonEmpty, org: nonEmpty, period: nonEmpty })).min(1),
    courses: z.array(z.object({ title: nonEmpty, provider: nonEmpty.optional(), year: z.number().int() })),
  }),
});

/** Feature studies rendered at /work/<slug>/. */
const studies = defineCollection({
  loader: glob({ pattern: '*.md', base: 'src/content/studies' }),
  schema: z.object({
    title: nonEmpty,
    order: z.number().int(),
    summary: nonEmpty,
    kicker: nonEmpty,
    product: nonEmpty,
    context: nonEmpty,
    userTask: nonEmpty,
    contribution: nonEmpty,
    teamBoundary: nonEmpty,
    responsibilities: z.array(nonEmpty).min(1),
    technologies: z.array(nonEmpty).min(1),
    walkthrough: z.string().regex(/^[a-z0-9-]+$/),
    diagram: z.object({ src: z.string().regex(/^diagrams\/[\w-]+\.svg$/), alt: nonEmpty, caption: nonEmpty }),
  }),
});

/** Illustrative phone screens shared by the 2D gallery and the Three.js scene. */
const walkthrough = defineCollection({
  loader: file('src/content/walkthrough.json'),
  schema: z.object({
    label: nonEmpty,
    study: z.string().regex(/^[a-z0-9-]+$/),
    /** Feature appears in the homepage 3D showcase. */
    showcase: z.boolean().default(false),
    steps: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9-]+$/),
          title: nonEmpty,
          image: z.string().regex(/^showcase\/[\w-]+\.svg$/),
          alt: nonEmpty,
          caption: nonEmpty,
          kind: z.enum(['illustration', 'approved-image']),
          /** Numbered callouts on the screen; x/y are percentages of the screen. */
          pins: z
            .array(z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100), text: nonEmpty }))
            .max(3)
            .default([]),
        }),
      )
      .length(3),
  }),
});

export const collections = { profile, studies, walkthrough };

/* Static seed data for the blog index and the six articles, extracted from blog.html and blog/*.html.
   Article text is plain paragraphs and level-2 headings. Replaced by D1 content later. */
import type { BlogPost } from "./types";

export const blogPosts: BlogPost[] = [
  {
    "slug": "design-systems-that-survive",
    "meta": {
      "title": "Design systems that survive contact with a roadmap — Visuolab",
      "description": "Most design systems die in month four. Here is what the ones that last have in common — and the three things we now build on day one."
    },
    "category": "Product",
    "title": "Design systems that survive contact with a roadmap",
    "publishedAt": "2026-09-12",
    "readMinutes": 7,
    "author": {
      "name": "Jordan Ellis",
      "avatar": "/assets/people/jordan.webp"
    },
    "cover": {
      "src": "/assets/covers/design-systems-that-survive.webp",
      "alt": ""
    },
    "excerpt": "Most design systems die in month four. Here is what the ones that last have in common — and the three things we now build on day one.",
    "lead": "A design system is not a component library. It is an agreement between designers and engineers about how decisions get made — and agreements need maintenance.",
    "body": [
      {
        "type": "heading",
        "text": "Start with the ten screens you actually have"
      },
      {
        "type": "paragraph",
        "text": "Systems fail when they are designed in the abstract. Build the components the current product needs, in the order it needs them, and let the library grow out of real screens instead of a hypothetical catalogue."
      },
      {
        "type": "heading",
        "text": "Tokens before components"
      },
      {
        "type": "paragraph",
        "text": "Colour, type, spacing and motion as named values, shipped to code before anyone draws a button. Every component you build afterwards inherits the decisions instead of re-litigating them."
      },
      {
        "type": "heading",
        "text": "One owner, one hour a week"
      },
      {
        "type": "paragraph",
        "text": "The systems that survive have a name next to them. An hour a week of triage — what got added, what drifted, what should be deleted — is the difference between a system and a graveyard."
      },
      {
        "type": "heading",
        "text": "Motion is part of the system"
      },
      {
        "type": "paragraph",
        "text": "Durations and easings belong in the token set. Without them, every team invents its own timing and the product feels like four different products."
      }
    ],
    "outro": {
      "before": "Working on something like this?",
      "linkText": "Tell us about it",
      "href": "#contact",
      "after": " — we answer within a day."
    },
    "related": [
      "what-a-rebrand-actually-costs",
      "motion-that-earns-its-place"
    ]
  },
  {
    "slug": "what-a-rebrand-actually-costs",
    "meta": {
      "title": "What a rebrand actually costs (and what you get for it) — Visuolab",
      "description": "Ranges, line items and the three decisions that move the number more than anything else. No discovery call required."
    },
    "category": "Brand",
    "title": "What a rebrand actually costs (and what you get for it)",
    "publishedAt": "2026-08-28",
    "readMinutes": 6,
    "author": {
      "name": "Harriet Marlow",
      "avatar": "/assets/people/harriet.webp"
    },
    "cover": {
      "src": "/assets/covers/what-a-rebrand-actually-costs.webp",
      "alt": ""
    },
    "lead": "Every agency answers this with \"it depends\". That is true and useless, so here is the shape of the number and what actually moves it.",
    "body": [
      {
        "type": "heading",
        "text": "Scope beats seniority"
      },
      {
        "type": "paragraph",
        "text": "A wordmark for a five-person startup and a wordmark for a company with three showrooms and a van fleet are the same craft and very different projects. What changes the price is the number of surfaces the identity has to live on."
      },
      {
        "type": "heading",
        "text": "Research is the optional half"
      },
      {
        "type": "paragraph",
        "text": "Positioning work, interviews and market audits can double a budget. Sometimes they are essential; sometimes the founders already know the answer and need someone to draw it well."
      },
      {
        "type": "heading",
        "text": "Rollout is where budgets go missing"
      },
      {
        "type": "paragraph",
        "text": "The identity is a few weeks. Applying it to packaging, signage, templates and a site is where the rest of the money and time goes — plan it as its own phase."
      },
      {
        "type": "heading",
        "text": "What we quote"
      },
      {
        "type": "paragraph",
        "text": "A fixed price per scope, agreed before we start. If the scope changes, the number changes and we say so that week — never at the end."
      }
    ],
    "outro": {
      "before": "Working on something like this?",
      "linkText": "Tell us about it",
      "href": "#contact",
      "after": " — we answer within a day."
    },
    "related": [
      "motion-that-earns-its-place",
      "the-brief-that-writes-itself"
    ]
  },
  {
    "slug": "motion-that-earns-its-place",
    "meta": {
      "title": "Motion that earns its place — Visuolab",
      "description": "A simple test for whether an animation should ship: does it explain, guide or delight? If it does none of the three, cut it."
    },
    "category": "Motion",
    "title": "Motion that earns its place",
    "publishedAt": "2026-08-14",
    "readMinutes": 5,
    "author": {
      "name": "Ingrid Halvorsen",
      "avatar": "/assets/people/ingrid.webp"
    },
    "cover": {
      "src": "/assets/covers/motion-that-earns-its-place.webp",
      "alt": ""
    },
    "lead": "Motion is the easiest thing to add and the hardest thing to justify. We run every animation through the same three questions before it ships.",
    "body": [
      {
        "type": "heading",
        "text": "Does it explain?"
      },
      {
        "type": "paragraph",
        "text": "The best animations teach: where a panel came from, what a swipe will do, how yield accrues. If an animation makes a mechanism legible, it has earned its place."
      },
      {
        "type": "heading",
        "text": "Does it guide?"
      },
      {
        "type": "paragraph",
        "text": "Motion directs attention. A state change that animates tells the user their action worked; a list that staggers tells them where to start reading."
      },
      {
        "type": "heading",
        "text": "Does it delight — once?"
      },
      {
        "type": "paragraph",
        "text": "A moment of charm is worth it the first time and irritating the fiftieth. Delight belongs in rare moments: onboarding, empty states, a successful payment."
      },
      {
        "type": "heading",
        "text": "The durations we default to"
      },
      {
        "type": "paragraph",
        "text": "120ms for state feedback, 240–320ms for transitions, 600ms+ only for storytelling. Ease-out for things entering, ease-in for things leaving."
      }
    ],
    "outro": {
      "before": "Working on something like this?",
      "linkText": "Tell us about it",
      "href": "#contact",
      "after": " — we answer within a day."
    },
    "related": [
      "the-brief-that-writes-itself",
      "webflow-or-next-js"
    ]
  },
  {
    "slug": "the-brief-that-writes-itself",
    "meta": {
      "title": "The brief that writes itself — Visuolab",
      "description": "Five questions we ask before every project. If you can answer them, you probably do not need an agency to find the problem — just to solve it."
    },
    "category": "Process",
    "title": "The brief that writes itself",
    "publishedAt": "2026-07-30",
    "readMinutes": 4,
    "author": {
      "name": "Jordan Ellis",
      "avatar": "/assets/people/jordan.webp"
    },
    "cover": {
      "src": "/assets/covers/the-brief-that-writes-itself.webp",
      "alt": ""
    },
    "lead": "Most projects that go wrong went wrong in the brief. These five questions surface the disagreement early, while it is still cheap.",
    "body": [
      {
        "type": "heading",
        "text": "What has to be true in twelve months?"
      },
      {
        "type": "paragraph",
        "text": "Not the deliverable — the outcome. If the answer is \"more qualified leads\", the project is different from one where the answer is \"we can raise a Series B\"."
      },
      {
        "type": "heading",
        "text": "Who decides?"
      },
      {
        "type": "paragraph",
        "text": "Name the person who can say yes. Projects with three equal decision-makers take twice as long and end up designed by committee."
      },
      {
        "type": "heading",
        "text": "What is already working?"
      },
      {
        "type": "paragraph",
        "text": "There is always something. Knowing what not to touch protects the equity you have already built."
      },
      {
        "type": "heading",
        "text": "What is the real deadline?"
      },
      {
        "type": "paragraph",
        "text": "A board meeting, a trade show, a launch window. Real dates change the plan; invented ones just add stress."
      },
      {
        "type": "heading",
        "text": "What does failure look like?"
      },
      {
        "type": "paragraph",
        "text": "The clearest question of the five. Teams who can describe failure precisely are the ones who describe success precisely too."
      }
    ],
    "outro": {
      "before": "Working on something like this?",
      "linkText": "Tell us about it",
      "href": "#contact",
      "after": " — we answer within a day."
    },
    "related": [
      "webflow-or-next-js",
      "designing-for-trust-in-fintech"
    ]
  },
  {
    "slug": "webflow-or-next-js",
    "meta": {
      "title": "Webflow or Next.js? A decision tree we actually use — Visuolab",
      "description": "Marketing site, app-adjacent, or somewhere in between — here is how we choose, and when we have been wrong."
    },
    "category": "Web",
    "title": "Webflow or Next.js? A decision tree we actually use",
    "publishedAt": "2026-07-16",
    "readMinutes": 6,
    "author": {
      "name": "Ingrid Halvorsen",
      "avatar": "/assets/people/ingrid.webp"
    },
    "cover": {
      "src": "/assets/covers/webflow-or-next-js.webp",
      "alt": ""
    },
    "lead": "This is a question about who will maintain the site, not about which technology is better.",
    "body": [
      {
        "type": "heading",
        "text": "Who edits it, and how often?"
      },
      {
        "type": "paragraph",
        "text": "If marketing needs to ship a page on a Tuesday without an engineer, Webflow wins almost every time. If content changes rarely and lives next to the product, Next.js is simpler."
      },
      {
        "type": "heading",
        "text": "How much of it is product?"
      },
      {
        "type": "paragraph",
        "text": "Anything that reads live application state — dashboards, logged-in views, pricing that depends on the user — belongs in the app codebase."
      },
      {
        "type": "heading",
        "text": "What does the team already run?"
      },
      {
        "type": "paragraph",
        "text": "A four-person engineering team already deploying Next.js will maintain a Next.js site happily. The same team will resent a CMS they did not choose."
      },
      {
        "type": "heading",
        "text": "Where we have been wrong"
      },
      {
        "type": "paragraph",
        "text": "Twice we have built in Next.js for teams who then wanted daily content changes. Both migrated to Webflow within a year — the tell was a marketing hire we did not account for."
      }
    ],
    "outro": {
      "before": "Working on something like this?",
      "linkText": "Tell us about it",
      "href": "#contact",
      "after": " — we answer within a day."
    },
    "related": [
      "designing-for-trust-in-fintech",
      "design-systems-that-survive"
    ]
  },
  {
    "slug": "designing-for-trust-in-fintech",
    "meta": {
      "title": "Designing for trust in fintech — Visuolab",
      "description": "Showing fees before the wallet prompt lost us nothing and gained 44% more connections. A few more counter-intuitive results."
    },
    "category": "Product",
    "title": "Designing for trust in fintech",
    "publishedAt": "2026-07-02",
    "readMinutes": 8,
    "author": {
      "name": "Aiko Sato",
      "avatar": "/assets/people/aiko.webp"
    },
    "cover": {
      "src": "/assets/covers/designing-for-trust-in-fintech.webp",
      "alt": ""
    },
    "lead": "In finance, the fastest path to a conversion is usually not the shortest one. Every shortcut you take is a question the user answers with suspicion instead.",
    "body": [
      {
        "type": "heading",
        "text": "Show the cost before you ask for the commitment"
      },
      {
        "type": "paragraph",
        "text": "Fees, risks and limits up front. Every time we have tested this, completion went up — the people who leave were going to churn at the first statement anyway."
      },
      {
        "type": "heading",
        "text": "Plain language beats precise language"
      },
      {
        "type": "paragraph",
        "text": "\"You keep 97% of what you earn\" outperforms a technically perfect fee table. Put the table underneath for the people who want it."
      },
      {
        "type": "heading",
        "text": "Let people undo things"
      },
      {
        "type": "paragraph",
        "text": "A visible cancel, a clear refund path and a payment that can be edited for sixty seconds do more for trust than any badge or seal."
      },
      {
        "type": "heading",
        "text": "Identity checks at the moment of need"
      },
      {
        "type": "paragraph",
        "text": "Nobody wants to photograph a passport before they have seen the product. Move verification to the first transfer and funded accounts double."
      }
    ],
    "outro": {
      "before": "Working on something like this?",
      "linkText": "Tell us about it",
      "href": "#contact",
      "after": " — we answer within a day."
    },
    "related": [
      "design-systems-that-survive",
      "what-a-rebrand-actually-costs"
    ]
  }
];

/** Order of the posts on /blog: the first is the featured article, the rest fill the grid. */
export const blogOrder: string[] = ["design-systems-that-survive","what-a-rebrand-actually-costs","motion-that-earns-its-place","the-brief-that-writes-itself","webflow-or-next-js","designing-for-trust-in-fintech"];

/** Topic chips on /blog, in order. */
export const blogTopics: string[] = ["Brand","Product","Web","Motion","Process"];

export const blogHero = {"label":"Blog","lead":"What we ship, what we learn and what we would do differently. No thought leadership, no listicles.","title":"Notes on design and the work around it"};

export const blogMeta = {"title":"Blog — Visuolab","description":"Notes on brand, product, web and motion design from the Visuolab studio — what we ship, what we learn and what we would do differently."};

export const postBySlug = (slug: string) => blogPosts.find((p) => p.slug === slug);

/*
 * The current website copy as section content, typed section by section (the compiler checks every key and every field against the schemas).
 * It is what the seed step writes into `page_sections`, and the content a section falls back to if its row is missing or no longer passes its
 * schema, so a damaged row can never break a page. scripts/db/verify-pages.mjs validates every entry. Text is taken from the live site (the
 * Home and About lists from the seeded settings, the rest from the components).
 */
import type { PageContent, PageTemplate } from "./types.ts";

export const PAGE_DEFAULTS: { [P in PageTemplate]: PageContent<P> } = {
  home: {
    hero: {
      "eyebrow": "Digital product design agency",
      "title": "The design partner that unites <em>brand</em>, <em>website</em> and <em>product</em> into one story.",
      "primaryCta": {
        "label": "Book a call",
        "href": "#contact"
      },
      "secondaryCta": {
        "label": "See our work",
        "href": "#work"
      },
      "sceneLabel": "Two human hands reach toward each other in front of a glowing sphere. Scrolling brings the fingertips together."
    },
    logos: {
      "label": "Trusted by"
    },
    showreel: {
      "video": {
        "id": "media_showreel",
        "alt": ""
      },
      "poster": {
        "id": "media_showreel-poster",
        "alt": ""
      },
      "tag": "Showreel ’26",
      "time": "00:16"
    },
    why: {
      "label": "Why Visuolab",
      "title": "<em>Visuolab</em> is the right call when you need",
      "items": [
        {
          "label": "Senior designers from day one",
          "href": "#contact"
        },
        {
          "label": "A start within one week",
          "href": "#contact"
        },
        {
          "label": "Guaranteed on-time deliverables",
          "href": "#contact"
        },
        {
          "label": "One team for brand, product and web",
          "href": "#contact"
        },
        {
          "label": "Motion built in, not bolted on",
          "href": "#contact"
        },
        {
          "label": "Clean handoff to any stack",
          "href": "#contact"
        }
      ],
      "stats": [
        {
          "value": "9<em>+</em>",
          "label": "years in business"
        },
        {
          "value": "140<em>+</em>",
          "label": "products launched"
        },
        {
          "value": "5<em>.0</em>",
          "label": "average client rating"
        },
        {
          "value": "30<em>+</em>",
          "label": "industries served"
        }
      ]
    },
    services: {
      "label": "Services",
      "title": "Brand, product and web, <em>designed as one</em>",
      "lead": "One tight team carries the idea from workshop to launch, so it looks and feels the same on every surface it touches.",
      "columns": [
        {
          "title": "Branding",
          "links": [
            {
              "label": "Brand strategy",
              "href": "#contact"
            },
            {
              "label": "Naming",
              "href": "#contact"
            },
            {
              "label": "Visual identity",
              "href": "#contact"
            },
            {
              "label": "Art direction",
              "href": "#contact"
            },
            {
              "label": "Brand guidelines",
              "href": "#contact"
            }
          ]
        },
        {
          "title": "Product design",
          "links": [
            {
              "label": "UX research",
              "href": "#contact"
            },
            {
              "label": "UI design",
              "href": "#contact"
            },
            {
              "label": "Mobile app design",
              "href": "#contact"
            },
            {
              "label": "Design systems",
              "href": "#contact"
            },
            {
              "label": "Prototyping",
              "href": "#contact"
            }
          ]
        },
        {
          "title": "Web & motion",
          "links": [
            {
              "label": "Web design",
              "href": "#contact"
            },
            {
              "label": "Webflow development",
              "href": "#contact"
            },
            {
              "label": "Next.js sites",
              "href": "#contact"
            },
            {
              "label": "Motion design",
              "href": "#contact"
            },
            {
              "label": "3D & illustration",
              "href": "#contact"
            }
          ]
        }
      ],
      "bookBar": {
        "avatar": {
          "id": "media_people-jordan",
          "alt": ""
        },
        "name": "Jordan Ellis",
        "role": "Founder & Creative Director",
        "text": "Grow your brand with a team that has shipped 140+ products — and stays until yours is live.",
        "cta": {
          "label": "Book a call",
          "href": "#contact"
        }
      }
    },
    work: {
      "label": "Our cases",
      "title": "Work that <em>moved the needle</em>",
      "caseIds": [
        "case_orbit",
        "case_marlow",
        "case_kite",
        "case_verdant"
      ],
      "allLabel": "View all projects"
    },
    industries: {
      "label": "Industries we serve",
      "title": "Deep in the markets that <em>move fastest</em>",
      "lead": "We've shipped brands, products and sites across 30+ industries. These are the four we know best — where our playbooks are sharpest and the results come quickest.",
      "items": [
        {
          "title": "SaaS & B2B",
          "text": "Positioning, product UI and marketing sites for software teams that need to explain something complex in a single scroll."
        },
        {
          "title": "Fintech",
          "text": "Onboarding, dashboards and trust-building brand work for money apps, where every screen has to feel safe before it feels clever."
        },
        {
          "title": "Health & wellness",
          "text": "Calm, accessible product design and packaging for care, skincare and wellbeing brands that people trust with their bodies."
        },
        {
          "title": "E-commerce & retail",
          "text": "Storefronts, packaging and campaigns built to convert on the shelf and in the feed — and to keep customers coming back."
        }
      ]
    },
    process: {
      "label": "How we work",
      "title": "A process built for <em>momentum</em>",
      "lead": "Four steps, one team, no big reveals. You see the work as it happens and decide on real things — not slide decks.",
      "facts": [
        "8–14 week engagements",
        "Weekly working sessions",
        "One shared design file"
      ],
      "cta": {
        "label": "Book an intro call",
        "href": "#contact"
      },
      "steps": [
        {
          "label": "Discover",
          "title": "Understand <em>before</em> we design",
          "text": "Stakeholder interviews, user research and a hard look at what exists today. We leave with a shared definition of the problem worth solving.",
          "outputs": [
            "Research readout",
            "Audit",
            "Success metrics"
          ],
          "when": "1–2 weeks"
        },
        {
          "label": "Define",
          "title": "Agree on the <em>destination</em>",
          "text": "Positioning, design principles and a prioritised scope — sketched as quick concepts so decisions get made on something you can see.",
          "outputs": [
            "Creative direction",
            "Concepts",
            "Roadmap"
          ],
          "when": "1–2 weeks"
        },
        {
          "label": "Design",
          "title": "Craft, <em>in the open</em>",
          "text": "Brand, interface and motion take shape in one shared file you can open any time. Weekly sessions replace presentations, so nothing lands as a surprise.",
          "outputs": [
            "Identity / UI",
            "Prototype",
            "Design system"
          ],
          "when": "4–8 weeks"
        },
        {
          "label": "Deliver",
          "title": "Ship it, then <em>keep going</em>",
          "text": "We build it ourselves or pair with your engineers through launch — then stay on to measure what happened and iterate on what's next.",
          "outputs": [
            "Build or handoff",
            "Launch support",
            "Retainer"
          ],
          "when": "2–4 weeks"
        }
      ]
    },
    reviews: {
      "label": "Verified reviews",
      "title": "What our <em>clients</em> say"
    },
  },
  about: {
    hero: {
      "label": "About Visuolab",
      "title": "Design that carries\n<em>one idea</em> from\nsketch to launch.",
      "lead": "Fourteen designers, strategists and design engineers across four continents. No account managers, no hand-offs — the people you meet on the first call do the work.",
      "facts": [
        "Founded 2017",
        "14 people, one team",
        "Lisbon & remote",
        "140+ launches"
      ]
    },
    mosaic: {
      "caseIds": [
        "case_orbit",
        "case_marlow",
        "case_kite",
        "case_verdant"
      ]
    },
    principles: {
      "label": "How we think",
      "title": "The principles <em>behind</em> the work",
      "lead": "Five things we won't compromise on, whatever the brief.",
      "items": [
        {
          "title": "Craft over volume",
          "text": "We take on a handful of projects at a time so senior people stay on yours from kickoff to launch."
        },
        {
          "title": "One idea, every surface",
          "text": "Brand, product and web are designed by the same hands, so the story doesn't drift between them."
        },
        {
          "title": "Motion is meaning",
          "text": "Animation earns its place by explaining, guiding or delighting — never by default."
        },
        {
          "title": "Decide on real things",
          "text": "Concepts, prototypes and working files replace slide decks. You see the work as it happens."
        },
        {
          "title": "Ship, then keep going",
          "text": "Launch is a milestone, not the finish line. We stay to measure, learn and iterate."
        }
      ]
    },
    mission: {
      "mission": {
        "tag": "The image of the future",
        "title": "Mission",
        "text": "To design brands, products and websites that carry one idea faithfully from the first sketch to the last screen — with small senior teams, honest advice, and the patience to stay past launch and keep improving what we shipped."
      },
      "vision": {
        "tag": "Our ambition",
        "title": "Vision",
        "text": "To be the studio founders call first — trusted with the work that defines a company, still around when it's time to evolve it, and a place where every launch raises the bar for the next one."
      }
    },
    story: {
      "label": "Our story",
      "title": "From <em>two laptops</em> in Lisbon to a studio on four continents",
      "items": [
        {
          "year": "2017",
          "title": "Two designers, one desk",
          "text": "Visuolab starts as a two-person brand studio in a shared Lisbon workspace. First client: a seed-stage fintech that is still with us."
        },
        {
          "year": "2019",
          "title": "Product joins brand",
          "text": "The first product-design retainer turns a brand shop into a full design studio. Five people, first Clutch reviews."
        },
        {
          "year": "2021",
          "title": "Remote by design",
          "text": "We go fully distributed, with teammates in Toronto and Singapore, and become a Webflow professional partner."
        },
        {
          "year": "2023",
          "title": "The hundredth launch",
          "text": "Design engineering and motion become core disciplines. First Awwwards Site of the Day."
        },
        {
          "year": "2026",
          "title": "Today",
          "text": "Fourteen people across four continents, 140+ launches — and still no account managers between you and the work."
        }
      ]
    },
    manifesto: {
      "label": "Why Visuolab exists",
      "text": "We started Visuolab because we were tired of watching <em>good ideas</em> get diluted between the deck, the design and the build. So we built a studio where <em>the same people</em> carry an idea from the first sketch to the last screen — and stay accountable for how it performs. Small on purpose. Senior by default. <em>Honest</em> about what will and won't move the needle."
    },
    places: {
      "label": "Where we work",
      "title": "Four continents. <em>One working day.</em>",
      "lead": "Lisbon is home. Toronto, Singapore and Sydney keep the sun up on your project — whatever your timezone, there are at least four shared hours a day and a designer who's awake.",
      "items": [
        {
          "timeZone": "Europe/Lisbon",
          "city": "Lisbon",
          "country": "Portugal · HQ",
          "flag": "PT"
        },
        {
          "timeZone": "America/Toronto",
          "city": "Toronto",
          "country": "Canada",
          "flag": "CA"
        },
        {
          "timeZone": "Asia/Singapore",
          "city": "Singapore",
          "country": "Singapore",
          "flag": "SG"
        },
        {
          "timeZone": "Australia/Sydney",
          "city": "Sydney",
          "country": "Australia",
          "flag": "AU"
        }
      ]
    },
    faq: {
      "label": "FAQ",
      "title": "Questions <em>we get</em> a lot",
      "lead": "Can't find yours? Write to us — a real person answers within a day.",
      "cta": {
        "label": "Ask us anything",
        "href": ""
      },
      "items": [
        {
          "question": "What does a typical engagement look like?",
          "answer": "Most projects run six to fourteen weeks: a brand or product sprint first, then web design and build. Teams that want a design partner on call work with us on a monthly retainer instead."
        },
        {
          "question": "How do you price?",
          "answer": "A fixed price per scope for defined projects and a flat monthly rate for retainers. You'll have a number before we start, and it doesn't move unless the scope does."
        },
        {
          "question": "Who will actually work on our project?",
          "answer": "The people you meet in the first call. A lead designer, a design engineer and a strategist stay on your project from kickoff to launch — there's no hand-off to a junior team."
        },
        {
          "question": "Do you work with early-stage startups?",
          "answer": "Yes — about a third of our launches are pre-Series A. We'll tell you plainly what's worth building now and what can wait until you have users."
        },
        {
          "question": "Do you build what you design?",
          "answer": "Yes. Webflow for marketing sites, Next.js when the product needs it. Design and build sit in the same room, so nothing gets lost between them."
        },
        {
          "question": "What happens after launch?",
          "answer": "We stay. Most clients keep us on for a few months of measuring, learning and iterating — and 72% come back for the next thing."
        }
      ]
    },
    careers: {
      "label": "Careers",
      "title": "Open <em>roles</em>",
      "items": [
        {
          "title": "Senior Product Designer",
          "meta": "Lisbon or remote · Full-time",
          "subject": "Senior Product Designer"
        },
        {
          "title": "Design Engineer (Webflow / Next.js)",
          "meta": "Remote · Full-time",
          "subject": "Design Engineer"
        },
        {
          "title": "Brand Designer",
          "meta": "Lisbon · Full-time",
          "subject": "Brand Designer"
        },
        {
          "title": "Don't see your role? Write to us anyway",
          "meta": "Open application",
          "subject": "Open application"
        }
      ]
    },
  },
  works: {
    hero: {
      "label": "Works",
      "title": "Work that <em>moved</em> the needle",
      "lead": "140+ launches since 2017. These are the ones we're proudest of — each with the brief, the thinking and the numbers behind it.",
      "allLabel": "All",
      "chipLabels": {
        "brand": "Brand",
        "product": "Product",
        "web": "Web",
        "packaging": "Packaging",
        "motion": "Motion"
      }
    },
    grid: {
      "emptyText": "Nothing here yet — try another filter."
    },
    reviews: {
      "label": "Testimonials",
      "title": "What the <em>clients</em> behind these projects say"
    },
  },
  blog: {
    hero: {
      "label": "Blog",
      "title": "Notes on <em>design</em> and the work around it",
      "lead": "What we ship, what we learn and what we would do differently. No thought leadership, no listicles.",
      "allLabel": "All"
    },
    featured: {
      "linkLabel": "Read the article"
    },
    grid: {
      "emptyText": "Nothing here yet — try another topic."
    },
  },
  contact: {
    intro: {
      "label": "Contact",
      "title": "Tell us where you are and where you want to <em>be</em>",
      "who": {
        "avatar": {
          "id": "media_people-jordan",
          "alt": ""
        },
        "name": "Jordan Ellis",
        "role": "Founder & Creative Director — answers new enquiries"
      },
      "direct": [
        {
          "label": "Email",
          "text": "{email}",
          "mailSubject": ""
        },
        {
          "label": "New business",
          "text": "Book a 30-min intro call",
          "mailSubject": "New project"
        }
      ],
      "facts": [
        "Answer within 1 working day",
        "Lisbon & remote — 4 continents",
        "Projects from €20k"
      ]
    },
    form: {
      "name": {
        "label": "Your name",
        "placeholder": "Jane Okafor"
      },
      "email": {
        "label": "Email",
        "placeholder": "jane@company.com"
      },
      "company": {
        "label": "Company",
        "placeholder": "Company name"
      },
      "message": {
        "label": "About the project",
        "placeholder": "What are you building, what's the deadline, and what does success look like?"
      },
      "needLegend": "What do you need?",
      "needOptions": [
        "Brand identity",
        "Product design",
        "Web design & build",
        "Motion & 3D",
        "Not sure yet"
      ],
      "budgetLegend": "Budget range",
      "budgetOptions": [
        "Under €20k",
        "€20–50k",
        "€50–100k",
        "€100k+",
        "Not sure yet"
      ],
      "submitLabel": "Send message",
      "note": "By sending this you agree we may reply by email. That's it — no list, no sequence.",
      "success": "Thanks — that's with us. You'll hear back within one working day.",
      "error": "Something went wrong. Please try again, or email {email}."
    },
  },
  service_detail: {
    logos: {
      "label": "Trusted by"
    },
    reviews: {
      "label": "Verified reviews",
      "title": "What our <em>clients</em> say"
    },
  },
  case_study_detail: {
    chrome: {
      "breadcrumbRoot": "Works",
      "allProjectsLabel": "All projects"
    },
  },
  article_detail: {
    chrome: {
      "breadcrumbRoot": "Blog",
      "tocLabel": "On this page",
      "shareLabel": "Share",
      "relatedLabel": "Keep reading",
      "relatedTitle": "More from the <em>studio</em>",
      "relatedAllLabel": "All articles"
    },
  },
  shared: {
    cta: {
      "title": "Ready to discuss your <em>project</em> with us?",
      "lead": "Tell us where you are and where you want to be. We'll come back within a day with how we'd get you there.",
      "primary": {
        "label": "Book a call",
        "href": ""
      },
      "avatars": [
        {
          "id": "media_people-jordan",
          "alt": ""
        },
        {
          "id": "media_people-team-2",
          "alt": ""
        },
        {
          "id": "media_people-aiko",
          "alt": ""
        }
      ],
      "floaters": [
        {
          "id": "media_cases-orbit",
          "alt": ""
        },
        {
          "id": "media_cases-kite",
          "alt": ""
        },
        {
          "id": "media_cases-marlow",
          "alt": ""
        },
        {
          "id": "media_cases-verdant",
          "alt": ""
        }
      ]
    },
    reviews: {
      "items": [
        {
          "avatar": {
            "id": "media_people-maya",
            "alt": ""
          },
          "company": "Orbit",
          "dot": "",
          "quote": "They tailor their solutions to our specific needs and goals.",
          "name": "Maya Rao",
          "role": "Head of Product, Orbit",
          "city": "New York, NY"
        },
        {
          "avatar": {
            "id": "media_people-harriet",
            "alt": ""
          },
          "company": "Marlow & Co.",
          "dot": "#ffb86b",
          "quote": "They organized their work and internal management was outstanding.",
          "name": "Harriet Marlow",
          "role": "Managing Director, Marlow & Co.",
          "city": "London, UK"
        },
        {
          "avatar": {
            "id": "media_people-ingrid",
            "alt": ""
          },
          "company": "Kite",
          "dot": "#8a4dff",
          "quote": "Working with them was a great experience. It's the site our investors forward.",
          "name": "Ingrid Halvorsen",
          "role": "Co-founder, Kite",
          "city": "Berlin, DE"
        },
        {
          "avatar": {
            "id": "media_people-aiko",
            "alt": ""
          },
          "company": "Verdant",
          "dot": "#1fa88a",
          "quote": "Meticulous attention to detail and creative problem-solving from the first workshop.",
          "name": "Aiko Sato",
          "role": "Founder, Verdant",
          "city": "Tokyo, JP"
        },
        {
          "avatar": {
            "id": "media_people-rosa",
            "alt": ""
          },
          "company": "Northwind",
          "dot": "#0b0b0e",
          "quote": "The rare agency that cares as much about the handoff as the pitch.",
          "name": "Rosa Almeida",
          "role": "VP Marketing, Northwind",
          "city": "Lisbon, PT"
        }
      ]
    },
    logos: {
      "items": [
        {
          "text": "NORTHWIND",
          "style": "caps",
          "dot": false
        },
        {
          "text": "halcyon",
          "style": "plain",
          "dot": true
        },
        {
          "text": "Marlow & Co.",
          "style": "serif",
          "dot": false
        },
        {
          "text": "orbit_",
          "style": "mono",
          "dot": false
        },
        {
          "text": "ASTER LABS",
          "style": "caps",
          "dot": false
        },
        {
          "text": "Kite",
          "style": "plain",
          "dot": false
        },
        {
          "text": "Verdant",
          "style": "serif",
          "dot": false
        },
        {
          "text": "fold.",
          "style": "plain",
          "dot": true
        },
        {
          "text": "quill",
          "style": "mono",
          "dot": false
        },
        {
          "text": "TESSEL",
          "style": "caps",
          "dot": false
        }
      ]
    },
    rating: {
      "score": "5.0",
      "text": "60+ reviews on Clutch"
    },
    footer: {
      "newsletterText": "Subscribe to our newsletter to stay in touch with the latest.",
      "newsletterPlaceholder": "Your email address",
      "badges": {
        "clutch": {
          "line1": "60+ reviews",
          "line2": "on Clutch"
        },
        "dribbble": {
          "line1": "Top 50 trending",
          "line2": "team on Dribbble"
        },
        "awwwards": {
          "line1": "Site of the Day",
          "line2": "× 3 on Awwwards"
        },
        "webflow": {
          "line1": "Professional partner",
          "line2": "by Webflow"
        },
        "goodfirms": {
          "line1": "Top user experience",
          "line2": "team by GoodFirms"
        },
        "behance": {
          "line1": "Projects are featured",
          "line2": "on Behance"
        }
      },
      "legal": [
        {
          "label": "Privacy policy",
          "href": "#"
        },
        {
          "label": "Cookie policy",
          "href": "#"
        },
        {
          "label": "Terms",
          "href": "#"
        }
      ],
      "copyright": "© 2016–2026 Visuolab"
    },
  },
};

/** The default content of one section, or undefined if the template has no such section. */
export const defaultContent = (template: PageTemplate, key: string): unknown => (PAGE_DEFAULTS[template] as Partial<Record<string, unknown>>)[key];

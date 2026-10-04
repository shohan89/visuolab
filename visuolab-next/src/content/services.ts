/* Static seed data for the four service pages, extracted from service/*.html.
   Inline markup is limited to <em>…</em>. Replaced by D1 content later. */
import type { ServiceSeed } from "./types";

export const services: ServiceSeed[] = [
  {
    "slug": "brand-identity",
    "meta": {
      "title": "Brand identity — Visuolab",
      "description": "A brand that still makes sense when the company doubles in size. Name, look, voice and the rules that keep them consistent — built from what the business actually does, not from a mood board."
    },
    "hero": {
      "title": "A brand that still makes sense when the company <em>doubles in size</em>",
      "lead": "Name, look, voice and the rules that keep them consistent — built from what the business actually does, not from a mood board.",
      "cta": {
        "label": "Start a project",
        "href": "/contact"
      },
      "shots": [
        {
          "src": "/assets/cases/marlow.webp",
          "alt": "",
          "width": 1200,
          "height": 900,
          "priority": true
        },
        {
          "src": "/assets/cases/verdant.webp",
          "alt": "",
          "width": 1200,
          "height": 900,
          "lazy": true
        }
      ]
    },
    "problems": {
      "hidden": true,
      "label": "What we fix",
      "title": "The problems that <em>bring people here</em>",
      "items": [
        {
          "title": "Looks like the competition",
          "text": "Three companies in your category use the same blue and the same grotesk. Nobody remembers which one you were.",
          "proofValue": "3<em>→</em>1",
          "proofLabel": "directions, then a decision"
        },
        {
          "title": "Falls apart off-screen",
          "text": "The mark was drawn for a website. On a box, a van and a 32-pixel favicon it stops working.",
          "proofValue": "32<em>px</em>",
          "proofLabel": "tested at favicon size and van size"
        },
        {
          "title": "Nobody follows the rules",
          "text": "A 90-page PDF that no one opens. Six months later there are four versions of the logo in circulation.",
          "proofValue": "1",
          "proofLabel": "file the whole team works from"
        },
        {
          "title": "Founder-dependent taste",
          "text": "Decisions get made on personal preference because there is no agreed reason for anything.",
          "proofValue": "100<em>%</em>",
          "proofLabel": "of calls written down and agreed"
        }
      ]
    },
    "overview": {
      "label": "Overview",
      "title": "Built for the rollout, <em>not the reveal</em>",
      "blocks": [
        {
          "title": "Why it matters",
          "text": "Most identity work fails in the rollout, not the reveal. A logo that looks perfect in a presentation falls apart the moment it meets a packaging dieline, a 32-pixel favicon and a marketing team in a hurry. So we design for the surfaces first and let the mark come out of them."
        },
        {
          "title": "How we do it",
          "text": "We start in the business: what you sell, to whom, and why it should be you. That becomes positioning, then a verbal identity, then the visual system — wordmark, type, colour, art direction — and finally the guidelines and templates that let twenty people use it without asking permission."
        },
        {
          "title": "Why choose us",
          "text": "The people who pitch the idea are the people who draw it — no account managers, no juniors picking it up after the kickoff. And because brand, product and web sit under one roof, the identity is tested on a real site and a real app before it is signed off, not after."
        },
        {
          "title": "Our experience",
          "text": "Forty-plus identities since 2017, from a fourth-generation furniture maker to a skincare brand that did not have a name yet. Marlow & Co. saw 62% more direct traffic in six months; Verdant’s first production run sold out."
        }
      ]
    },
    "outcomes": {
      "label": "What changes",
      "title": "Numbers from <em>real projects</em>",
      "items": [
        {
          "value": "62<em>%</em>",
          "text": "more direct traffic in the six months after a rebrand"
        },
        {
          "value": "3<em>×</em>",
          "text": "faster asset production once the templates land"
        },
        {
          "value": "18<em></em>",
          "text": "press features for a client in launch year one"
        }
      ]
    },
    "band": {
      "hidden": true,
      "text": "Need an identity that survives the rollout? <em>We can help.</em>",
      "cta": {
        "label": "Book a call",
        "href": "/contact"
      }
    },
    "included": {
      "label": "What's included",
      "title": "Everything in <em>brand identity</em>",
      "items": [
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "circle",
                "a": {
                  "cx": "12",
                  "cy": "12",
                  "r": "8.2"
                }
              },
              {
                "t": "circle",
                "a": {
                  "cx": "12",
                  "cy": "12",
                  "r": "3.4"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M12 1.8v2.4M12 19.8v2.4M1.8 12h2.4M19.8 12h2.4"
                }
              }
            ]
          },
          "title": "Brand strategy",
          "text": "Positioning, audience, messaging pillars and the one sentence everything else hangs on."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "circle",
                "a": {
                  "cx": "12",
                  "cy": "12",
                  "r": "8.4"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M8.4 12.2l2.6 2.6 4.8-5"
                }
              }
            ]
          },
          "title": "Naming & verbal identity",
          "text": "Candidate names, trademark screening, tone of voice and the words you use for your own things."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "circle",
                "a": {
                  "cx": "9.2",
                  "cy": "9.2",
                  "r": "5.2"
                }
              },
              {
                "t": "rect",
                "a": {
                  "x": "10.4",
                  "y": "10.4",
                  "width": "9.6",
                  "height": "9.6",
                  "rx": "2.2"
                }
              }
            ]
          },
          "title": "Visual identity",
          "text": "Wordmark, symbol, type system, colour, layout grid and iconography."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "rect",
                "a": {
                  "x": "3.2",
                  "y": "4.6",
                  "width": "17.6",
                  "height": "14.8",
                  "rx": "2.4"
                }
              },
              {
                "t": "circle",
                "a": {
                  "cx": "8.6",
                  "cy": "9.6",
                  "r": "1.9"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M3.6 16.4l5-4.6 4.2 3.8 3-2.6 5 4.4"
                }
              }
            ]
          },
          "title": "Art direction",
          "text": "Photography and illustration direction, with shoot guides your team can brief against."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "path",
                "a": {
                  "d": "M12 2.8l8.4 4.4v9.6L12 21.2 3.6 16.8V7.2z"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M3.6 7.2L12 11.6l8.4-4.4M12 11.6v9.6"
                }
              }
            ]
          },
          "title": "Packaging",
          "text": "Structure, dielines and print specs, press-checked on the first run."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "path",
                "a": {
                  "d": "M4.4 4.6h6.2a2.4 2.4 0 012.4 2.4v12.4a1.8 1.8 0 00-1.8-1.8H4.4z"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M19.6 4.6h-6.2a2.4 2.4 0 00-2.4 2.4v12.4a1.8 1.8 0 011.8-1.8h6.8z"
                }
              }
            ]
          },
          "title": "Guidelines",
          "text": "A brand book people actually open, plus working templates for deck, social and email."
        }
      ]
    },
    "process": {
      "label": "How it runs",
      "title": "Four phases, <em>one team</em>",
      "steps": [
        {
          "title": "Discovery",
          "duration": "1–2 weeks",
          "text": "Interviews, audit and a look at the category. We leave with a written point of view."
        },
        {
          "title": "Strategy",
          "duration": "1–2 weeks",
          "text": "Positioning, story and naming architecture — agreed before anything is drawn."
        },
        {
          "title": "Identity",
          "duration": "3–4 weeks",
          "text": "Three directions, then one, developed across the surfaces that matter to you."
        },
        {
          "title": "Rollout",
          "duration": "1–2 weeks",
          "text": "Guidelines, templates and the hand-off to whoever keeps it going."
        }
      ]
    },
    "cases": {
      "label": "Our cases",
      "title": "Work that <em>moved the needle</em>",
      "items": [
        {
          "href": "/works/marlow",
          "tags": [
            "Furniture",
            "Rebrand",
            "Packaging"
          ],
          "title": "A century-old furniture maker gets an identity with as much craft as its chairs",
          "image": {
            "src": "/assets/cases/marlow.webp",
            "alt": "Hovra furniture brand identity — placeholder from Dribbble",
            "lazy": true
          },
          "quote": {
            "source": "Clutch",
            "text": "They organized their work and internal management was outstanding. Every showroom now feels like one brand.",
            "avatar": "/assets/people/harriet.webp",
            "name": "Harriet Marlow",
            "role": "Managing Director, Marlow & Co."
          }
        },
        {
          "href": "/works/verdant",
          "tags": [
            "Skincare",
            "Naming",
            "Packaging"
          ],
          "title": "Verdant went from name to shelf in ten weeks and sold out its first run",
          "image": {
            "src": "/assets/cases/verdant.webp",
            "alt": "Leafora skincare packaging — placeholder from Dribbble",
            "lazy": true
          },
          "quote": {
            "source": "Clutch",
            "text": "Meticulous attention to detail and real creative problem-solving. Retail buyers asked who did the packaging.",
            "avatar": "/assets/people/aiko.webp",
            "name": "Aiko Sato",
            "role": "Founder, Verdant"
          }
        },
        {
          "href": "/works/northwind",
          "tags": [
            "Marketing",
            "Brand refresh",
            "Webflow"
          ],
          "title": "Northwind’s site turned a services list into a lead engine",
          "image": {
            "src": "/assets/cases/northwind.webp",
            "alt": "Northwind marketing agency site — design by Ridoy Rock",
            "lazy": true
          },
          "quote": {
            "source": "Clutch",
            "text": "The rare agency that cares as much about the handoff as the pitch.",
            "avatar": "/assets/people/rosa.webp",
            "name": "Rosa Almeida",
            "role": "VP Marketing, Northwind"
          }
        }
      ]
    }
  },
  {
    "slug": "product-design",
    "meta": {
      "title": "Product design — Visuolab",
      "description": "Interfaces people can use on their worst day. Research that answers real questions, flows built around one decision per screen, and a design system your engineers can actually ship."
    },
    "hero": {
      "title": "Interfaces people can use on their <em>worst day</em>",
      "lead": "Research that answers real questions, flows built around one decision per screen, and a design system your engineers can actually ship.",
      "cta": {
        "label": "Start a project",
        "href": "/contact"
      },
      "shots": [
        {
          "src": "/assets/cases/orbit.webp",
          "alt": "",
          "width": 1200,
          "height": 900,
          "priority": true
        },
        {
          "src": "/assets/cases/halcyon.webp",
          "alt": "",
          "width": 1200,
          "height": 900,
          "lazy": true
        }
      ]
    },
    "problems": {
      "hidden": true,
      "label": "What we fix",
      "title": "The problems that <em>bring people here</em>",
      "items": [
        {
          "title": "Users drop off in onboarding",
          "text": "Eleven screens before any value. Half the signups never reach the thing they came for.",
          "proofValue": "2<em>w</em>",
          "proofLabel": "to a prototype real users can hold"
        },
        {
          "title": "Every squad ships differently",
          "text": "Four date pickers, three empty states, no agreement on what a primary button is.",
          "proofValue": "40<em>%</em>",
          "proofLabel": "fewer support tickets after the rework"
        },
        {
          "title": "Support carries the design debt",
          "text": "The same five tickets every week, all of them answerable by a clearer screen.",
          "proofValue": "1",
          "proofLabel": "source of truth for design and code"
        },
        {
          "title": "Research nobody uses",
          "text": "A 60-slide deck from last year that never turned into a single design decision.",
          "proofValue": "8<em>+</em>",
          "proofLabel": "usability sessions before a line ships"
        }
      ]
    },
    "overview": {
      "label": "Overview",
      "title": "Designed for people <em>in a hurry</em>",
      "blocks": [
        {
          "title": "Why it matters",
          "text": "Software gets used by tired people in a hurry. That is the bar: not whether the interface photographs well, but whether someone can finish the task on their fourth interruption of the morning."
        },
        {
          "title": "How we do it",
          "text": "We research to settle the arguments that block decisions, design the flows one question at a time, and build the component system — tokens, states, motion — so that the tenth feature looks like it was always part of the plan. Then we stay through the build."
        },
        {
          "title": "Why choose us",
          "text": "Senior designers from the first call to the last hand-off, working in your Figma and your stand-ups rather than presenting at them. Engineers are in the room while we design, so what we hand over is something your team can ship — not a prototype that has to be redesigned in code."
        },
        {
          "title": "Our experience",
          "text": "Sixty-plus products across fintech, AI and developer tools since 2017. Orbit cut onboarding drop-off by 41% and more than doubled accounts funded in week one; Fold’s App Store rating rose from 3.8 to 4.7."
        }
      ]
    },
    "outcomes": {
      "label": "What changes",
      "title": "Numbers from <em>real projects</em>",
      "items": [
        {
          "value": "41<em>%</em>",
          "text": "less onboarding drop-off on a fintech app"
        },
        {
          "value": "2.3<em>×</em>",
          "text": "more accounts funded in the first week"
        },
        {
          "value": "4.8<em></em>",
          "text": "App Store rating after a redesign, up from 3.9"
        }
      ]
    },
    "band": {
      "hidden": true,
      "text": "Need a product people can actually get through? <em>We can help.</em>",
      "cta": {
        "label": "Book a call",
        "href": "/contact"
      }
    },
    "included": {
      "label": "What's included",
      "title": "Everything in <em>product design</em>",
      "items": [
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "circle",
                "a": {
                  "cx": "10.6",
                  "cy": "10.6",
                  "r": "6.6"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M15.6 15.6l4.8 4.8"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M8 10.6h5.2M10.6 8v5.2"
                }
              }
            ]
          },
          "title": "UX research",
          "text": "Interviews, funnel analytics and usability tests — enough to decide, not enough to stall."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "rect",
                "a": {
                  "x": "9",
                  "y": "2.8",
                  "width": "6",
                  "height": "5",
                  "rx": "1.4"
                }
              },
              {
                "t": "rect",
                "a": {
                  "x": "2.6",
                  "y": "16.2",
                  "width": "6",
                  "height": "5",
                  "rx": "1.4"
                }
              },
              {
                "t": "rect",
                "a": {
                  "x": "15.4",
                  "y": "16.2",
                  "width": "6",
                  "height": "5",
                  "rx": "1.4"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M12 7.8v4.4M5.6 16.2v-2.2h12.8v2.2M12 12.2v1.8"
                }
              }
            ]
          },
          "title": "Information architecture",
          "text": "Navigation, hierarchy and the naming people actually understand."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "rect",
                "a": {
                  "x": "3",
                  "y": "4",
                  "width": "18",
                  "height": "16",
                  "rx": "2.4"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M3 9h18M8.4 9v11"
                }
              }
            ]
          },
          "title": "UI design",
          "text": "Web and native screens, accessible by default, in light and dark where it matters."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "rect",
                "a": {
                  "x": "3.2",
                  "y": "3.2",
                  "width": "7.2",
                  "height": "7.2",
                  "rx": "1.8"
                }
              },
              {
                "t": "rect",
                "a": {
                  "x": "13.6",
                  "y": "3.2",
                  "width": "7.2",
                  "height": "7.2",
                  "rx": "1.8"
                }
              },
              {
                "t": "rect",
                "a": {
                  "x": "3.2",
                  "y": "13.6",
                  "width": "7.2",
                  "height": "7.2",
                  "rx": "1.8"
                }
              },
              {
                "t": "circle",
                "a": {
                  "cx": "17.2",
                  "cy": "17.2",
                  "r": "3.8"
                }
              }
            ]
          },
          "title": "Design systems",
          "text": "Tokens, components, states and documentation, shipped to code."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "rect",
                "a": {
                  "x": "2.6",
                  "y": "4.4",
                  "width": "7.4",
                  "height": "6",
                  "rx": "1.8"
                }
              },
              {
                "t": "rect",
                "a": {
                  "x": "14",
                  "y": "13.6",
                  "width": "7.4",
                  "height": "6",
                  "rx": "1.8"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M10 7.4h4.6a3 3 0 013 3v3.2"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M15.6 12l2 1.6-2 1.6"
                }
              }
            ]
          },
          "title": "Prototyping",
          "text": "Clickable flows tested with real users before a line of production code."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "path",
                "a": {
                  "d": "M8.6 7.4L3.8 12l4.8 4.6M15.4 7.4L20.2 12l-4.8 4.6M13.6 4.4l-3.2 15.2"
                }
              }
            ]
          },
          "title": "Design engineering",
          "text": "We pair with your engineers or build the front end ourselves."
        }
      ]
    },
    "process": {
      "label": "How it runs",
      "title": "Four phases, <em>one team</em>",
      "steps": [
        {
          "title": "Discovery",
          "duration": "2 weeks",
          "text": "Interviews, analytics and an audit of what exists. One page of agreed problems."
        },
        {
          "title": "Design",
          "duration": "4–8 weeks",
          "text": "Flows, screens and prototypes, reviewed in weekly working sessions."
        },
        {
          "title": "System",
          "duration": "2 weeks",
          "text": "Components, tokens and motion rules handed to the teams that will use them."
        },
        {
          "title": "Ship",
          "duration": "1–2 weeks",
          "text": "QA, pairing with engineering and instrumentation on the flows we changed."
        }
      ]
    },
    "cases": {
      "label": "Our cases",
      "title": "Work that <em>moved the needle</em>",
      "items": [
        {
          "href": "/works/orbit",
          "tags": [
            "Fintech",
            "Series B",
            "Product design"
          ],
          "title": "Orbit cut onboarding drop-off by 41% with a calmer money app",
          "image": {
            "src": "/assets/cases/orbit.webp",
            "alt": "Pesse fintech app screens — placeholder from Dribbble",
            "lazy": true
          },
          "quote": {
            "source": "Clutch",
            "text": "They tailor their solutions to our specific needs and goals. The onboarding redesign paid for itself within a quarter.",
            "avatar": "/assets/people/maya.webp",
            "name": "Maya Rao",
            "role": "Head of Product, Orbit"
          }
        },
        {
          "href": "/works/fold",
          "tags": [
            "Fintech",
            "Cards",
            "Product design"
          ],
          "title": "Fold’s card app put every balance one thumb away",
          "image": {
            "src": "/assets/cases/fold.webp",
            "alt": "Fold credit card app — design by Ridoy Rock",
            "lazy": true
          },
          "results": [
            {
              "value": "37<em>%</em>",
              "text": "more bills paid on time"
            },
            {
              "value": "4.7",
              "text": "App Store rating, up from 3.8"
            }
          ]
        },
        {
          "href": "/works/aster",
          "tags": [
            "Web3",
            "Fintech",
            "Product design"
          ],
          "title": "Aster Labs made earning and investing in crypto feel calm, not chaotic",
          "image": {
            "src": "/assets/cases/aster.webp",
            "alt": "Aster Labs crypto platform site — design by Ridoy Rock",
            "lazy": true
          },
          "results": [
            {
              "value": "44<em>%</em>",
              "text": "more wallets connected"
            },
            {
              "value": "2.2<em>×</em>",
              "text": "time spent on product pages"
            }
          ]
        }
      ]
    }
  },
  {
    "slug": "web-design-build",
    "meta": {
      "title": "Web design & build — Visuolab",
      "description": "A site that tells the story in one scroll — and that you can edit. Narrative first, then design, then a Webflow or Next.js build with a CMS your marketing team can use without an engineer."
    },
    "hero": {
      "title": "A site that tells the story in <em>one scroll</em> — and that you can edit",
      "lead": "Narrative first, then design, then a Webflow or Next.js build with a CMS your marketing team can use without an engineer.",
      "cta": {
        "label": "Start a project",
        "href": "/contact"
      },
      "shots": [
        {
          "src": "/assets/cases/kite.webp",
          "alt": "",
          "width": 1200,
          "height": 900,
          "priority": true
        },
        {
          "src": "/assets/cases/northwind.webp",
          "alt": "",
          "width": 1200,
          "height": 900,
          "lazy": true
        }
      ]
    },
    "problems": {
      "hidden": true,
      "label": "What we fix",
      "title": "The problems that <em>bring people here</em>",
      "items": [
        {
          "title": "Reads like a brochure",
          "text": "Six sections of features and no answer to “why you, why now”.",
          "proofValue": "90<em>+</em>",
          "proofLabel": "Lighthouse on the pages that matter"
        },
        {
          "title": "Every change needs an engineer",
          "text": "Marketing waits two sprints to fix a headline.",
          "proofValue": "1.2<em>s</em>",
          "proofLabel": "typical largest contentful paint"
        },
        {
          "title": "Slow on the devices that matter",
          "text": "A beautiful hero that costs four seconds on a mid-range phone.",
          "proofValue": "0",
          "proofLabel": "developers needed to change copy"
        },
        {
          "title": "Traffic without conversion",
          "text": "Visitors arrive, scroll, and leave without a single clear next step.",
          "proofValue": "100<em>%</em>",
          "proofLabel": "of components responsive by default"
        }
      ]
    },
    "overview": {
      "label": "Overview",
      "title": "A story told at <em>scroll speed</em>",
      "blocks": [
        {
          "title": "Why it matters",
          "text": "A website is a story told at scroll speed. Most agency sites are a features list in a nice typeface — the visitor leaves before they understand what you actually do."
        },
        {
          "title": "How we do it",
          "text": "We write the narrative before we design it: one idea per section, in order. Then we design it, build it in Webflow or Next.js, and set up a CMS so the team can ship a page on a Tuesday without filing a ticket. Performance and accessibility are part of the build, not a clean-up pass."
        },
        {
          "title": "Why choose us",
          "text": "Story, copy, design and development stay with one team, so nothing gets lost between the deck and the deploy. You get a site your marketers can run on their own — with a 98 average Lighthouse score, because performance is designed in rather than patched on."
        },
        {
          "title": "Our experience",
          "text": "Launch sites for AI, fintech and developer-tool companies, most of them live in six to ten weeks. Kite turned its launch page into 12k waitlist sign-ups in three weeks; Halcyon tripled demo requests in its first month."
        }
      ]
    },
    "outcomes": {
      "label": "What changes",
      "title": "Numbers from <em>real projects</em>",
      "items": [
        {
          "value": "2.4<em>×</em>",
          "text": "visitor-to-signup rate after a launch-site rebuild"
        },
        {
          "value": "12<em>k</em>",
          "text": "waitlist sign-ups in three weeks"
        },
        {
          "value": "98<em></em>",
          "text": "Lighthouse performance, mobile, at launch"
        }
      ]
    },
    "band": {
      "hidden": true,
      "text": "Need a site that loads fast and earns its keep? <em>We can help.</em>",
      "cta": {
        "label": "Book a call",
        "href": "/contact"
      }
    },
    "included": {
      "label": "What's included",
      "title": "Everything in <em>web design & build</em>",
      "items": [
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "circle",
                "a": {
                  "cx": "12",
                  "cy": "12",
                  "r": "8.4"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M8.4 12.2l2.6 2.6 4.8-5"
                }
              }
            ]
          },
          "title": "Messaging & narrative",
          "text": "The story, section by section, written and signed off before design starts."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "rect",
                "a": {
                  "x": "3",
                  "y": "4",
                  "width": "18",
                  "height": "16",
                  "rx": "2.4"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M3 9h18M7 13h7M7 16.2h4.4"
                }
              }
            ]
          },
          "title": "Web design",
          "text": "Desktop, tablet and phone — every state, not just the hero."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "path",
                "a": {
                  "d": "M8.6 7.4L3.8 12l4.8 4.6M15.4 7.4L20.2 12l-4.8 4.6M13.6 4.4l-3.2 15.2"
                }
              }
            ]
          },
          "title": "Webflow development",
          "text": "Built in Webflow with a CMS, plus training for whoever will run it."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "circle",
                "a": {
                  "cx": "12",
                  "cy": "12",
                  "r": "9"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M8.8 16V8l7.2 9.2M15.2 8v5.4"
                }
              }
            ]
          },
          "title": "Next.js development",
          "text": "When the site is app-adjacent or has to live in your repo."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "path",
                "a": {
                  "d": "M3.4 17.6c4.6 0 4.6-11.2 9.2-11.2s4.6 11.2 8 11.2"
                }
              },
              {
                "t": "circle",
                "a": {
                  "cx": "3.4",
                  "cy": "17.6",
                  "r": "1.7"
                }
              },
              {
                "t": "circle",
                "a": {
                  "cx": "20.6",
                  "cy": "17.6",
                  "r": "1.7"
                }
              }
            ]
          },
          "title": "Motion",
          "text": "Scroll and interaction motion that explains the product rather than decorating it."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "circle",
                "a": {
                  "cx": "12",
                  "cy": "12",
                  "r": "8.4"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M8.4 12.2l2.6 2.6 4.8-5"
                }
              }
            ]
          },
          "title": "Performance & accessibility",
          "text": "Core Web Vitals, semantics and keyboard paths, checked before launch."
        }
      ]
    },
    "process": {
      "label": "How it runs",
      "title": "Four phases, <em>one team</em>",
      "steps": [
        {
          "title": "Story",
          "duration": "1–2 weeks",
          "text": "Positioning, page map and the copy that carries it."
        },
        {
          "title": "Design",
          "duration": "2–4 weeks",
          "text": "Every page and state, with motion studies for the moments that need them."
        },
        {
          "title": "Build",
          "duration": "2–3 weeks",
          "text": "Webflow or Next.js, CMS wired, analytics installed."
        },
        {
          "title": "Launch",
          "duration": "1 week",
          "text": "QA across devices, launch-day support and a training session."
        }
      ]
    },
    "cases": {
      "label": "Our cases",
      "title": "Work that <em>moved the needle</em>",
      "items": [
        {
          "href": "/works/kite",
          "tags": [
            "Dev tools",
            "Launch site",
            "Motion"
          ],
          "title": "Kite's launch site turned a quiet beta into a 12,000-person waitlist",
          "image": {
            "src": "/assets/cases/kite.webp",
            "alt": "Lumina developer-tools landing page — placeholder from Dribbble",
            "lazy": true
          },
          "quote": {
            "source": "Clutch",
            "text": "Working with them was a great experience. The site does the selling so our engineers can stay heads-down.",
            "avatar": "/assets/people/ingrid.webp",
            "name": "Ingrid Halvorsen",
            "role": "Co-founder, Kite"
          }
        },
        {
          "href": "/works/northwind",
          "tags": [
            "Marketing",
            "Brand refresh",
            "Webflow"
          ],
          "title": "Northwind’s site turned a services list into a lead engine",
          "image": {
            "src": "/assets/cases/northwind.webp",
            "alt": "Northwind marketing agency site — design by Ridoy Rock",
            "lazy": true
          },
          "quote": {
            "source": "Clutch",
            "text": "The rare agency that cares as much about the handoff as the pitch.",
            "avatar": "/assets/people/rosa.webp",
            "name": "Rosa Almeida",
            "role": "VP Marketing, Northwind"
          }
        },
        {
          "href": "/works/halcyon",
          "tags": [
            "AI",
            "SaaS",
            "Web design"
          ],
          "title": "Halcyon’s new site explains AI agents in one scroll — and tripled demo requests",
          "image": {
            "src": "/assets/cases/halcyon.webp",
            "alt": "Halcyon AI agent marketing site — design by Ridoy Rock",
            "lazy": true
          },
          "results": [
            {
              "value": "3.1<em>×</em>",
              "text": "demo requests in the first month"
            },
            {
              "value": "48<em>%</em>",
              "text": "longer average visit"
            }
          ]
        }
      ]
    }
  },
  {
    "slug": "motion-3d",
    "meta": {
      "title": "Motion & 3D — Visuolab",
      "description": "Animation that explains something. Interface motion with real rules, hero animation, 3D and product video — for the moments where showing beats describing."
    },
    "hero": {
      "title": "Animation that <em>explains</em> something",
      "lead": "Interface motion with real rules, hero animation, 3D and product video — for the moments where showing beats describing.",
      "cta": {
        "label": "Start a project",
        "href": "/contact"
      },
      "shots": [
        {
          "src": "/assets/cases/aster.webp",
          "alt": "",
          "width": 1200,
          "height": 900,
          "priority": true
        },
        {
          "src": "/assets/cases/fold.webp",
          "alt": "",
          "width": 1200,
          "height": 900,
          "lazy": true
        }
      ]
    },
    "problems": {
      "hidden": true,
      "label": "What we fix",
      "title": "The problems that <em>bring people here</em>",
      "items": [
        {
          "title": "Motion as decoration",
          "text": "Things move because the template moved. None of it helps anyone understand the product.",
          "proofValue": "60<em>fps</em>",
          "proofLabel": "on the hardware your users actually own"
        },
        {
          "title": "Every team times it differently",
          "text": "One transition takes 600ms, the next 120ms, and the product feels unfinished.",
          "proofValue": "120<em>kb</em>",
          "proofLabel": "typical weight for a hero animation"
        },
        {
          "title": "Heavy hero, slow page",
          "text": "A 12MB video above the fold that most visitors never watch.",
          "proofValue": "1",
          "proofLabel": "motion spec the engineers can build from"
        },
        {
          "title": "A mechanism nobody gets",
          "text": "The thing you sell is hard to explain in a sentence, and the site tries anyway.",
          "proofValue": "4<em>×</em>",
          "proofLabel": "reuse across site, product and social"
        }
      ]
    },
    "overview": {
      "label": "Overview",
      "title": "Motion that has to <em>earn its place</em>",
      "blocks": [
        {
          "title": "Why it matters",
          "text": "Motion is the easiest thing to add and the hardest thing to justify. Every animation we ship has to explain, guide or delight — and delight only in the rare moments where it will not wear out."
        },
        {
          "title": "How we do it",
          "text": "We design the motion language as a system: durations, easings, what moves and why, documented and handed over as Lottie or GSAP. When the idea needs to be seen rather than read, we build it — hero animation, 3D scenes, shaders, product video."
        },
        {
          "title": "Why choose us",
          "text": "Our motion designers work alongside the product and brand teams from day one, so animation is part of the design rather than a layer added at the end. Everything ships as production-ready Lottie or GSAP with a written spec, and every animation has to pass the same three questions before it is built."
        },
        {
          "title": "Our experience",
          "text": "Motion systems, launch films and 3D scenes for products like Orbit, Fold and Kite — shipped inside the product, not left in a showreel. The same rules run through all of it: 120 ms for feedback, longer only when the motion is explaining something."
        }
      ]
    },
    "outcomes": {
      "label": "What changes",
      "title": "Numbers from <em>real projects</em>",
      "items": [
        {
          "value": "2.2<em>×</em>",
          "text": "time on product pages after a motion explainer"
        },
        {
          "value": "44<em>%</em>",
          "text": "more wallets connected with animated onboarding"
        },
        {
          "value": "60<em>fps</em>",
          "text": "the bar every scene has to hold"
        }
      ]
    },
    "band": {
      "hidden": true,
      "text": "Need motion that explains rather than decorates? <em>We can help.</em>",
      "cta": {
        "label": "Book a call",
        "href": "/contact"
      }
    },
    "included": {
      "label": "What's included",
      "title": "Everything in <em>motion & 3d</em>",
      "items": [
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "rect",
                "a": {
                  "x": "2.8",
                  "y": "4.6",
                  "width": "18.4",
                  "height": "13",
                  "rx": "2.2"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M9.8 8.8l5 3.3-5 3.3zM8 21h8"
                }
              }
            ]
          },
          "title": "Interface motion",
          "text": "Transitions, state feedback and micro-interactions, specified and built."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "path",
                "a": {
                  "d": "M3.4 17.6c4.6 0 4.6-11.2 9.2-11.2s4.6 11.2 8 11.2"
                }
              },
              {
                "t": "circle",
                "a": {
                  "cx": "3.4",
                  "cy": "17.6",
                  "r": "1.7"
                }
              },
              {
                "t": "circle",
                "a": {
                  "cx": "20.6",
                  "cy": "17.6",
                  "r": "1.7"
                }
              }
            ]
          },
          "title": "Motion guidelines",
          "text": "Durations, easings and rules, so every team animates the same way."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "circle",
                "a": {
                  "cx": "12",
                  "cy": "12",
                  "r": "8.4"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M8.4 12.2l2.6 2.6 4.8-5"
                }
              }
            ]
          },
          "title": "3D & shaders",
          "text": "Real-time WebGL scenes and rendered 3D for heroes and product explainers."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "rect",
                "a": {
                  "x": "2.6",
                  "y": "6",
                  "width": "13.4",
                  "height": "12",
                  "rx": "2.2"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M16 11l5.4-3.2v8.4L16 13z"
                }
              }
            ]
          },
          "title": "Product video",
          "text": "Scripted, edited and colour-graded showreels and explainers."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "path",
                "a": {
                  "d": "M4 18.6l7-12.6 4.4 7.8"
                }
              },
              {
                "t": "circle",
                "a": {
                  "cx": "17.4",
                  "cy": "16.6",
                  "r": "3.4"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M3.4 20.4h17.2"
                }
              }
            ]
          },
          "title": "Illustration systems",
          "text": "A drawing language that flexes across the brand."
        },
        {
          "icon": {
            "viewBox": "0 0 24 24",
            "nodes": [
              {
                "t": "path",
                "a": {
                  "d": "M13.6 3.4c3.6 1 6 3.4 7 7l-8 8-4.8-2.2-2.2-4.8z"
                }
              },
              {
                "t": "path",
                "a": {
                  "d": "M9.6 14.4l-4 4M5.6 11.6l-2.2 2.2M12.4 18.4l2.2 2.2"
                }
              }
            ]
          },
          "title": "Launch assets",
          "text": "Social cuts, Product Hunt assets and everything launch day needs."
        }
      ]
    },
    "process": {
      "label": "How it runs",
      "title": "Four phases, <em>one team</em>",
      "steps": [
        {
          "title": "Direction",
          "duration": "1 week",
          "text": "References, principles and the list of moments worth animating."
        },
        {
          "title": "Studies",
          "duration": "1–2 weeks",
          "text": "Rough motion tests on the real interface, not on a placeholder."
        },
        {
          "title": "Production",
          "duration": "1–2 weeks",
          "text": "Final animation, 3D or video, produced and optimised."
        },
        {
          "title": "Hand-off",
          "duration": "1 week",
          "text": "Lottie/GSAP assets, a motion spec and implementation support."
        }
      ]
    },
    "cases": {
      "label": "Our cases",
      "title": "Work that <em>moved the needle</em>",
      "items": [
        {
          "href": "/works/kite",
          "tags": [
            "Dev tools",
            "Launch site",
            "Motion"
          ],
          "title": "Kite's launch site turned a quiet beta into a 12,000-person waitlist",
          "image": {
            "src": "/assets/cases/kite.webp",
            "alt": "Lumina developer-tools landing page — placeholder from Dribbble",
            "lazy": true
          },
          "quote": {
            "source": "Clutch",
            "text": "Working with them was a great experience. The site does the selling so our engineers can stay heads-down.",
            "avatar": "/assets/people/ingrid.webp",
            "name": "Ingrid Halvorsen",
            "role": "Co-founder, Kite"
          }
        },
        {
          "href": "/works/orbit",
          "tags": [
            "Fintech",
            "Series B",
            "Product design"
          ],
          "title": "Orbit cut onboarding drop-off by 41% with a calmer money app",
          "image": {
            "src": "/assets/cases/orbit.webp",
            "alt": "Pesse fintech app screens — placeholder from Dribbble",
            "lazy": true
          },
          "quote": {
            "source": "Clutch",
            "text": "They tailor their solutions to our specific needs and goals. The onboarding redesign paid for itself within a quarter.",
            "avatar": "/assets/people/maya.webp",
            "name": "Maya Rao",
            "role": "Head of Product, Orbit"
          }
        },
        {
          "href": "/works/fold",
          "tags": [
            "Fintech",
            "Cards",
            "Product design"
          ],
          "title": "Fold’s card app put every balance one thumb away",
          "image": {
            "src": "/assets/cases/fold.webp",
            "alt": "Fold credit card app — design by Ridoy Rock",
            "lazy": true
          },
          "results": [
            {
              "value": "37<em>%</em>",
              "text": "more bills paid on time"
            },
            {
              "value": "4.7",
              "text": "App Store rating, up from 3.8"
            }
          ]
        }
      ]
    }
  }
];

export const serviceBySlug = (slug: string) => services.find((s) => s.slug === slug);

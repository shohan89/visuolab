/* Static seed data for the eight case studies and the /works index, extracted from work/*.html and works.html.
   Inline markup in text is limited to <em>…</em> and <b>…</b>. Replaced by D1 content later. */
import type { CaseStudy } from "./types";

export const caseStudies: CaseStudy[] = [
  {
    "slug": "orbit",
    "meta": {
      "title": "Orbit — Visuolab",
      "description": "Orbit case study: Orbit cut onboarding drop-off by 41% with a calmer money app."
    },
    "card": {
      "name": "Orbit",
      "year": "2025",
      "type": "Fintech app · Fintech",
      "tags": [
        "Product",
        "Motion"
      ],
      "filters": [
        "product",
        "motion"
      ],
      "image": {
        "src": "/assets/cases/orbit.webp",
        "alt": "Pesse fintech app screens — placeholder from Dribbble"
      }
    },
    "hero": {
      "breadcrumb": "Orbit",
      "title": "Orbit cut onboarding drop-off by <em>41%</em> with a calmer money app",
      "facts": [
        {
          "term": "Client",
          "value": "Orbit Financial"
        },
        {
          "term": "Industry",
          "value": "Fintech · Series B"
        },
        {
          "term": "Services",
          "value": "Product design, Design system, Motion"
        },
        {
          "term": "Year",
          "value": "2025"
        },
        {
          "term": "Timeline",
          "value": "12 weeks"
        }
      ]
    },
    "cover": {
      "src": "/assets/cases/orbit.webp",
      "alt": "Pesse fintech app screens — placeholder from Dribbble"
    },
    "about": {
      "label": "About project",
      "lead": "<em>Orbit</em> is a consumer banking app that had grown feature by feature until nobody could see the whole of it. Onboarding ran to eleven screens, half of all new users never funded an account, and every squad shipped its own components. Visuolab rebuilt the first run and the system underneath it so money feels calm again — without pausing the roadmap.",
      "stats": [
        {
          "value": "41<em>%</em>",
          "label": "less onboarding drop-off"
        },
        {
          "value": "2.3<em>×</em>",
          "label": "accounts funded in week one"
        },
        {
          "value": "4.8<em></em>",
          "label": "App Store rating, up from 3.9"
        }
      ]
    },
    "galleryA": [
      {
        "src": "/assets/cases/orbit.webp",
        "position": "20% 30%",
        "alt": "",
        "caption": "Onboarding, rebuilt around one question per screen"
      },
      {
        "src": "/assets/cases/orbit.webp",
        "position": "80% 70%",
        "alt": "",
        "caption": "Cards, transfers and the new home screen"
      }
    ],
    "process": {
      "label": "How it went",
      "title": "Four phases, <em>one team</em> throughout",
      "steps": [
        {
          "title": "Discovery",
          "duration": "2 weeks",
          "text": "Interviews with fourteen customers, funnel analytics and an audit of every onboarding screen.",
          "deliverables": [
            {
              "title": "Onboarding flow",
              "detail": "6 screens"
            },
            {
              "title": "Home, cards & transfers",
              "detail": "iOS · Android"
            }
          ]
        },
        {
          "title": "Design",
          "duration": "5 weeks",
          "text": "New onboarding, home, cards and transfers — tested as prototypes with real customers every week.",
          "deliverables": [
            {
              "title": "Design system",
              "detail": "40 components"
            },
            {
              "title": "Motion guidelines",
              "detail": "Figma + Lottie"
            }
          ]
        },
        {
          "title": "Build",
          "duration": "4 weeks",
          "text": "Design system tokens shipped to React Native; our design engineer paired with Orbit's squads.",
          "deliverables": [
            {
              "title": "Figma library",
              "detail": "Tokens, docs"
            }
          ]
        },
        {
          "title": "Launch",
          "duration": "1 week",
          "text": "Staged rollout to 10%, then everyone, with instrumentation on every step of the new flow.",
          "deliverables": [
            {
              "title": "Handoff & QA",
              "detail": "4 weeks"
            }
          ]
        }
      ]
    },
    "galleryB": [
      {
        "src": "/assets/cases/orbit.webp",
        "position": "20% 30%",
        "alt": "",
        "caption": "Onboarding, rebuilt around one question per screen"
      },
      {
        "src": "/assets/cases/orbit.webp",
        "position": "80% 70%",
        "alt": "",
        "caption": "Cards, transfers and the new home screen"
      }
    ],
    "challenges": {
      "label": "Challenges",
      "title": "What we had to <em>solve</em>",
      "items": [
        {
          "title": "An onboarding nobody finished",
          "text": "Eleven screens stood between download and a funded account, and half of new users gave up before the end."
        },
        {
          "title": "Four squads, four design languages",
          "text": "Every team shipped its own buttons, spacing and motion, so the app felt stitched together."
        },
        {
          "title": "No pause button",
          "text": "The roadmap kept moving the whole time — the redesign had to ship alongside live features, not instead of them."
        }
      ]
    },
    "wide": {
      "src": "/assets/cases/orbit.webp",
      "position": "50% 40%",
      "alt": "",
      "caption": "Cards, transfers and the new home screen"
    },
    "results": {
      "label": "What changed",
      "title": "Results",
      "items": [
        {
          "metric": true,
          "text": "<b>41%</b> less onboarding drop-off"
        },
        {
          "metric": true,
          "text": "<b>2.3×</b> accounts funded in week one"
        },
        {
          "metric": true,
          "text": "<b>4.8</b> App Store rating, up from 3.9"
        },
        {
          "metric": false,
          "text": "Eleven screens became six. Each asks one thing and says why it's needed."
        },
        {
          "metric": false,
          "text": "Identity checks moved to the first transfer, not the first minute. Funded accounts doubled."
        },
        {
          "metric": false,
          "text": "Forty components with motion rules, so new features look like they were always there."
        }
      ]
    },
    "more": {
      "label": "More work",
      "title": "Other projects <em>worth a look</em>",
      "items": [
        {
          "slug": "marlow",
          "name": "Marlow & Co.",
          "kind": "Rebrand",
          "image": "/assets/cases/marlow.webp"
        },
        {
          "slug": "kite",
          "name": "Kite",
          "kind": "Launch site",
          "image": "/assets/cases/kite.webp"
        },
        {
          "slug": "verdant",
          "name": "Verdant",
          "kind": "Packaging",
          "image": "/assets/cases/verdant.webp"
        }
      ]
    }
  },
  {
    "slug": "marlow",
    "meta": {
      "title": "Marlow & Co. — Visuolab",
      "description": "Marlow & Co. case study: A century-old furniture maker gets an identity with as much craft as its chairs."
    },
    "card": {
      "name": "Marlow & Co.",
      "year": "2024",
      "type": "Rebrand · Furniture",
      "tags": [
        "Brand",
        "Packaging"
      ],
      "filters": [
        "brand",
        "packaging"
      ],
      "image": {
        "src": "/assets/cases/marlow.webp",
        "alt": "Hovra furniture brand identity — placeholder from Dribbble"
      }
    },
    "hero": {
      "breadcrumb": "Marlow & Co.",
      "title": "A century-old furniture maker gets an identity with as much <em>craft</em> as its chairs",
      "facts": [
        {
          "term": "Client",
          "value": "Marlow & Co."
        },
        {
          "term": "Industry",
          "value": "Furniture · Retail"
        },
        {
          "term": "Services",
          "value": "Brand strategy, Visual identity, Packaging"
        },
        {
          "term": "Year",
          "value": "2024"
        },
        {
          "term": "Timeline",
          "value": "10 weeks"
        }
      ]
    },
    "cover": {
      "src": "/assets/cases/marlow.webp",
      "alt": "Hovra furniture brand identity — placeholder from Dribbble"
    },
    "about": {
      "label": "About project",
      "lead": "<em>Marlow & Co.</em> is a fourth-generation furniture maker with three showrooms and a mark that had been redrawn so many times nobody could say which one was right. Visuolab drew a single identity that holds in a design-store window and on the side of a delivery van without reading as two different companies.",
      "stats": [
        {
          "value": "62<em>%</em>",
          "label": "more direct traffic in six months"
        },
        {
          "value": "3<em></em>",
          "label": "showrooms rolled out in one season"
        },
        {
          "value": "18<em></em>",
          "label": "press features in the first year"
        }
      ]
    },
    "galleryA": [
      {
        "src": "/assets/cases/marlow.webp",
        "position": "20% 30%",
        "alt": "",
        "caption": "The wordmark, cut like a dovetail joint"
      },
      {
        "src": "/assets/cases/marlow.webp",
        "position": "80% 70%",
        "alt": "",
        "caption": "Showroom signage and delivery livery"
      }
    ],
    "process": {
      "label": "How it went",
      "title": "Four phases, <em>one team</em> throughout",
      "steps": [
        {
          "title": "Discovery",
          "duration": "2 weeks",
          "text": "Workshop visits, a dig through a century of catalogues and interviews in all three showrooms.",
          "deliverables": [
            {
              "title": "Brand strategy",
              "detail": "Positioning, story"
            },
            {
              "title": "Wordmark & identity",
              "detail": "Type, colour, grid"
            }
          ]
        },
        {
          "title": "Strategy",
          "duration": "2 weeks",
          "text": "Positioning, brand story and a naming architecture for the collections.",
          "deliverables": [
            {
              "title": "Packaging system",
              "detail": "3 formats"
            },
            {
              "title": "Showroom signage",
              "detail": "3 locations"
            }
          ]
        },
        {
          "title": "Identity",
          "duration": "4 weeks",
          "text": "Wordmark, type, colour and photography direction; packaging and showroom signage.",
          "deliverables": [
            {
              "title": "Photography direction",
              "detail": "Shoot guide"
            }
          ]
        },
        {
          "title": "Rollout",
          "duration": "2 weeks",
          "text": "Brand book, templates and a coordinated launch across the showrooms and the van fleet.",
          "deliverables": [
            {
              "title": "Brand book",
              "detail": "96 pages"
            }
          ]
        }
      ]
    },
    "galleryB": [
      {
        "src": "/assets/cases/marlow.webp",
        "position": "20% 30%",
        "alt": "",
        "caption": "The wordmark, cut like a dovetail joint"
      },
      {
        "src": "/assets/cases/marlow.webp",
        "position": "80% 70%",
        "alt": "",
        "caption": "Showroom signage and delivery livery"
      }
    ],
    "challenges": {
      "label": "Challenges",
      "title": "What we had to <em>solve</em>",
      "items": [
        {
          "title": "A mark with too many versions",
          "text": "The logo had been redrawn so often that nobody could say which one was right."
        },
        {
          "title": "Two worlds, one brand",
          "text": "It had to feel at home in a design-store window and on the side of a delivery van."
        },
        {
          "title": "Four generations of history",
          "text": "A century of craft to honour without the brand turning into a museum piece."
        }
      ]
    },
    "wide": {
      "src": "/assets/cases/marlow.webp",
      "position": "50% 40%",
      "alt": "",
      "caption": "Showroom signage and the delivery livery"
    },
    "results": {
      "label": "What changed",
      "title": "Results",
      "items": [
        {
          "metric": true,
          "text": "<b>62%</b> more direct traffic in six months"
        },
        {
          "metric": true,
          "text": "<b>3</b> showrooms rolled out in one season"
        },
        {
          "metric": true,
          "text": "<b>18</b> press features in the first year"
        },
        {
          "metric": false,
          "text": "The joins in the wordmark mirror the joinery — a detail customers noticed unprompted."
        },
        {
          "metric": false,
          "text": "A palette sampled in the workshop, warm enough to hold up in print and on screen."
        },
        {
          "metric": false,
          "text": "Kraft, cloth tape and a signed card in every delivery. The unboxing is part of the brand."
        }
      ]
    },
    "more": {
      "label": "More work",
      "title": "Other projects <em>worth a look</em>",
      "items": [
        {
          "slug": "kite",
          "name": "Kite",
          "kind": "Launch site",
          "image": "/assets/cases/kite.webp"
        },
        {
          "slug": "verdant",
          "name": "Verdant",
          "kind": "Packaging",
          "image": "/assets/cases/verdant.webp"
        },
        {
          "slug": "halcyon",
          "name": "Halcyon",
          "kind": "Marketing site",
          "image": "/assets/cases/halcyon.webp"
        }
      ]
    }
  },
  {
    "slug": "kite",
    "meta": {
      "title": "Kite — Visuolab",
      "description": "Kite case study: Kite's launch site turned a quiet beta into a 12,000-person waitlist."
    },
    "card": {
      "name": "Kite",
      "year": "2025",
      "type": "Launch site · Dev tools",
      "tags": [
        "Web",
        "Motion"
      ],
      "filters": [
        "web",
        "motion"
      ],
      "image": {
        "src": "/assets/cases/kite.webp",
        "alt": "Lumina developer-tools landing page — placeholder from Dribbble"
      }
    },
    "hero": {
      "breadcrumb": "Kite",
      "title": "Kite's launch site turned a quiet beta into a <em>12,000-person</em> waitlist",
      "facts": [
        {
          "term": "Client",
          "value": "Kite"
        },
        {
          "term": "Industry",
          "value": "Developer tools"
        },
        {
          "term": "Services",
          "value": "Web design, Webflow development, Motion"
        },
        {
          "term": "Year",
          "value": "2025"
        },
        {
          "term": "Timeline",
          "value": "6 weeks"
        }
      ]
    },
    "cover": {
      "src": "/assets/cases/kite.webp",
      "alt": "Lumina developer-tools landing page — placeholder from Dribbble"
    },
    "about": {
      "label": "About project",
      "lead": "<em>Kite</em> is a developer tool with a product engineers already loved and a landing page nobody understood. Launch was six weeks out, the team was four people, and none of them wanted to spend the summer maintaining a website. Visuolab built a site they could run themselves and still have it look designed.",
      "stats": [
        {
          "value": "12<em>k</em>",
          "label": "waitlist sign-ups in three weeks"
        },
        {
          "value": "2.4<em>×</em>",
          "label": "visitor-to-signup rate"
        },
        {
          "value": "98<em></em>",
          "label": "Lighthouse performance score"
        }
      ]
    },
    "galleryA": [
      {
        "src": "/assets/cases/kite.webp",
        "position": "20% 30%",
        "alt": "",
        "caption": "The hero: one sentence, one live demo"
      },
      {
        "src": "/assets/cases/kite.webp",
        "position": "80% 70%",
        "alt": "",
        "caption": "Feature story told scroll by scroll"
      }
    ],
    "process": {
      "label": "How it went",
      "title": "Four phases, <em>one team</em> throughout",
      "steps": [
        {
          "title": "Discovery",
          "duration": "1 week",
          "text": "Founder interviews, a competitor teardown and the one sentence the whole site hangs on.",
          "deliverables": [
            {
              "title": "Messaging & narrative",
              "detail": "One-sentence story"
            },
            {
              "title": "Launch site",
              "detail": "Webflow"
            }
          ]
        },
        {
          "title": "Design",
          "duration": "2 weeks",
          "text": "Narrative scroll, the live demo module and motion studies for the workflow.",
          "deliverables": [
            {
              "title": "Live demo module",
              "detail": "Embedded product"
            },
            {
              "title": "Motion system",
              "detail": "GSAP"
            }
          ]
        },
        {
          "title": "Build",
          "duration": "2 weeks",
          "text": "Webflow build with CMS, GSAP motion and a performance pass to a 98 Lighthouse score.",
          "deliverables": [
            {
              "title": "Launch assets",
              "detail": "Product Hunt, social"
            }
          ]
        },
        {
          "title": "Launch",
          "duration": "1 week",
          "text": "Launch-day support, Product Hunt assets and analytics wired to the waitlist.",
          "deliverables": [
            {
              "title": "CMS setup",
              "detail": "Docs + training"
            }
          ]
        }
      ]
    },
    "galleryB": [
      {
        "src": "/assets/cases/kite.webp",
        "position": "20% 30%",
        "alt": "",
        "caption": "The hero: one sentence, one live demo"
      },
      {
        "src": "/assets/cases/kite.webp",
        "position": "80% 70%",
        "alt": "",
        "caption": "Feature story told scroll by scroll"
      }
    ],
    "challenges": {
      "label": "Challenges",
      "title": "What we had to <em>solve</em>",
      "items": [
        {
          "title": "A product nobody could explain",
          "text": "Engineers loved it, but the landing page lost everyone else in the first scroll."
        },
        {
          "title": "Six weeks to launch",
          "text": "The date was fixed: the site had to be designed, built and live before it."
        },
        {
          "title": "A team of four",
          "text": "Nobody had time to maintain a website, so it had to run itself after hand-off."
        }
      ]
    },
    "wide": {
      "src": "/assets/cases/kite.webp",
      "position": "50% 40%",
      "alt": "",
      "caption": "The feature story, told scroll by scroll"
    },
    "results": {
      "label": "What changed",
      "title": "Results",
      "items": [
        {
          "metric": true,
          "text": "<b>12k</b> waitlist sign-ups in three weeks"
        },
        {
          "metric": true,
          "text": "<b>2.4×</b> visitor-to-signup rate"
        },
        {
          "metric": true,
          "text": "<b>98</b> Lighthouse performance score"
        },
        {
          "metric": false,
          "text": "Every scroll answers one question in order: what is it, why now, why you."
        },
        {
          "metric": false,
          "text": "A live, embedded product that visitors can actually try from the hero."
        },
        {
          "metric": false,
          "text": "Everything lives in the Webflow CMS, so four engineers never have to touch the site."
        }
      ]
    },
    "more": {
      "label": "More work",
      "title": "Other projects <em>worth a look</em>",
      "items": [
        {
          "slug": "verdant",
          "name": "Verdant",
          "kind": "Packaging",
          "image": "/assets/cases/verdant.webp"
        },
        {
          "slug": "halcyon",
          "name": "Halcyon",
          "kind": "Marketing site",
          "image": "/assets/cases/halcyon.webp"
        },
        {
          "slug": "northwind",
          "name": "Northwind",
          "kind": "Website",
          "image": "/assets/cases/northwind.webp"
        }
      ]
    }
  },
  {
    "slug": "verdant",
    "meta": {
      "title": "Verdant — Visuolab",
      "description": "Verdant case study: Verdant went from name to shelf in ten weeks and sold out its first run."
    },
    "card": {
      "name": "Verdant",
      "year": "2024",
      "type": "Packaging · Skincare",
      "tags": [
        "Brand",
        "Packaging"
      ],
      "filters": [
        "brand",
        "packaging"
      ],
      "image": {
        "src": "/assets/cases/verdant.webp",
        "alt": "Leafora skincare packaging — placeholder from Dribbble"
      }
    },
    "hero": {
      "breadcrumb": "Verdant",
      "title": "Verdant went from name to shelf in <em>ten weeks</em> and sold out its first run",
      "facts": [
        {
          "term": "Client",
          "value": "Verdant Skincare"
        },
        {
          "term": "Industry",
          "value": "Skincare · DTC"
        },
        {
          "term": "Services",
          "value": "Naming, Brand identity, Packaging"
        },
        {
          "term": "Year",
          "value": "2024"
        },
        {
          "term": "Timeline",
          "value": "10 weeks"
        }
      ]
    },
    "cover": {
      "src": "/assets/cases/verdant.webp",
      "alt": "Leafora skincare packaging — placeholder from Dribbble"
    },
    "about": {
      "label": "About project",
      "lead": "<em>Verdant Skincare</em> began as two founders, a formula they believed in, and a retail slot that opened in ten weeks. There was no name, no brand and no packaging — and a shelf already full of competitors whispering “clean” and “natural”. Visuolab built the whole thing, from the word on the carton to the carton itself.",
      "stats": [
        {
          "value": "100<em>%</em>",
          "label": "of the first production run sold out"
        },
        {
          "value": "12<em></em>",
          "label": "SKUs by the end of year one, up from 3"
        },
        {
          "value": "41<em>%</em>",
          "label": "higher shelf pick-up in store tests"
        }
      ]
    },
    "galleryA": [
      {
        "src": "/assets/cases/verdant.webp",
        "position": "20% 30%",
        "alt": "",
        "caption": "The botanical line that carries the whole system"
      },
      {
        "src": "/assets/cases/verdant.webp",
        "position": "80% 70%",
        "alt": "",
        "caption": "Uncoated stock, one spot colour"
      }
    ],
    "process": {
      "label": "How it went",
      "title": "Four phases, <em>one team</em> throughout",
      "steps": [
        {
          "title": "Naming",
          "duration": "1 week",
          "text": "Two hundred candidates, twelve on the shortlist, trademark checks — and one name.",
          "deliverables": [
            {
              "title": "Naming",
              "detail": "Trademark-cleared"
            },
            {
              "title": "Brand identity",
              "detail": "Illustration, type, colour"
            }
          ]
        },
        {
          "title": "Identity",
          "duration": "3 weeks",
          "text": "The botanical illustration, type, colour and a tone of voice for the packs.",
          "deliverables": [
            {
              "title": "Packaging",
              "detail": "3 SKUs, 12 by year one"
            },
            {
              "title": "Illustration system",
              "detail": "Botanical line"
            }
          ]
        },
        {
          "title": "Packaging",
          "duration": "4 weeks",
          "text": "Structure, dielines and print tests on uncoated stock for three SKUs.",
          "deliverables": [
            {
              "title": "Tone of voice",
              "detail": "Pack copy"
            }
          ]
        },
        {
          "title": "Launch",
          "duration": "2 weeks",
          "text": "Press checks in Lisbon, retail shelf tests and launch photography direction.",
          "deliverables": [
            {
              "title": "Launch photography",
              "detail": "Art direction"
            }
          ]
        }
      ]
    },
    "galleryB": [
      {
        "src": "/assets/cases/verdant.webp",
        "position": "20% 30%",
        "alt": "",
        "caption": "The botanical line that carries the whole system"
      },
      {
        "src": "/assets/cases/verdant.webp",
        "position": "80% 70%",
        "alt": "",
        "caption": "Uncoated stock, one spot colour"
      }
    ],
    "challenges": {
      "label": "Challenges",
      "title": "What we had to <em>solve</em>",
      "items": [
        {
          "title": "Starting from nothing",
          "text": "No name, no brand and no packaging — just a formula and two founders who believed in it."
        },
        {
          "title": "Ten weeks to the shelf",
          "text": "The retail slot was already booked, so every decision came with a deadline."
        },
        {
          "title": "A crowded, whispering shelf",
          "text": "Every competitor already claimed “clean” and “natural”; Verdant needed another way to be noticed."
        }
      ]
    },
    "wide": {
      "src": "/assets/cases/verdant.webp",
      "position": "50% 40%",
      "alt": "",
      "caption": "The botanical line, from tube to carton"
    },
    "results": {
      "label": "What changed",
      "title": "Results",
      "items": [
        {
          "metric": true,
          "text": "<b>100%</b> of the first production run sold out"
        },
        {
          "metric": true,
          "text": "<b>12</b> SKUs by the end of year one, up from 3"
        },
        {
          "metric": true,
          "text": "<b>41%</b> higher shelf pick-up in store tests"
        },
        {
          "metric": false,
          "text": "A single botanical illustration flexes from tube to carton to website."
        },
        {
          "metric": false,
          "text": "Uncoated stock and one spot colour: the calmest thing in the aisle, and the most picked up."
        },
        {
          "metric": false,
          "text": "We stood at the press for the first run. It shows in the first run."
        }
      ]
    },
    "more": {
      "label": "More work",
      "title": "Other projects <em>worth a look</em>",
      "items": [
        {
          "slug": "halcyon",
          "name": "Halcyon",
          "kind": "Marketing site",
          "image": "/assets/cases/halcyon.webp"
        },
        {
          "slug": "northwind",
          "name": "Northwind",
          "kind": "Website",
          "image": "/assets/cases/northwind.webp"
        },
        {
          "slug": "aster",
          "name": "Aster Labs",
          "kind": "Platform site",
          "image": "/assets/cases/aster.webp"
        }
      ]
    }
  },
  {
    "slug": "halcyon",
    "meta": {
      "title": "Halcyon — Visuolab",
      "description": "Halcyon case study: Halcyon's new site explains AI agents in one scroll — and tripled demo requests."
    },
    "card": {
      "name": "Halcyon",
      "year": "2026",
      "type": "Marketing site · AI · SaaS",
      "tags": [
        "Web",
        "Motion"
      ],
      "filters": [
        "web",
        "motion"
      ],
      "image": {
        "src": "/assets/cases/halcyon.webp",
        "alt": "Halcyon AI agent marketing site — design by Ridoy Rock"
      }
    },
    "hero": {
      "breadcrumb": "Halcyon",
      "title": "Halcyon's new site explains <em>AI agents</em> in one scroll — and tripled demo requests",
      "facts": [
        {
          "term": "Client",
          "value": "Halcyon"
        },
        {
          "term": "Industry",
          "value": "AI · SaaS"
        },
        {
          "term": "Services",
          "value": "Web design, Webflow development, Motion"
        },
        {
          "term": "Year",
          "value": "2026"
        },
        {
          "term": "Timeline",
          "value": "7 weeks"
        }
      ]
    },
    "cover": {
      "src": "/assets/cases/halcyon.webp",
      "alt": "Halcyon AI agent marketing site — design by Ridoy Rock"
    },
    "about": {
      "label": "About project",
      "lead": "<em>Halcyon</em> sells AI agents to operations teams who do not speak AI. The old site was a feature list: visitors left before they understood what an agent could actually take off their plate. Visuolab rewrote the story around the work being done, then designed the site that tells it.",
      "stats": [
        {
          "value": "3.1<em>×</em>",
          "label": "demo requests in the first month"
        },
        {
          "value": "48<em>%</em>",
          "label": "longer average visit"
        },
        {
          "value": "7<em></em>",
          "label": "weeks from kickoff to launch"
        }
      ]
    },
    "galleryA": [
      {
        "src": "/assets/cases/halcyon.webp",
        "position": "20% 30%",
        "alt": "",
        "caption": "Hero with the live chain-of-thought demo"
      },
      {
        "src": "/assets/cases/halcyon.webp",
        "position": "80% 70%",
        "alt": "",
        "caption": "Workflow explainer and pricing"
      }
    ],
    "process": {
      "label": "How it went",
      "title": "Four phases, <em>one team</em> throughout",
      "steps": [
        {
          "title": "Discovery",
          "duration": "1 week",
          "text": "Sales-call recordings, support tickets and a competitor teardown gave us the questions the site had to answer.",
          "deliverables": [
            {
              "title": "Messaging & narrative",
              "detail": "Outcome-first"
            },
            {
              "title": "Marketing site",
              "detail": "Webflow"
            }
          ]
        },
        {
          "title": "Story",
          "duration": "1 week",
          "text": "Outcome-first messaging and a page-by-page narrative, signed off before any pixels.",
          "deliverables": [
            {
              "title": "Live demo module",
              "detail": "Embedded"
            },
            {
              "title": "Motion system",
              "detail": "GSAP"
            }
          ]
        },
        {
          "title": "Design",
          "duration": "3 weeks",
          "text": "Hero, live demo, workflow explainer and pricing; motion studies for the chain-of-thought.",
          "deliverables": [
            {
              "title": "Integrations CMS",
              "detail": "900+ tools"
            }
          ]
        },
        {
          "title": "Build",
          "duration": "2 weeks",
          "text": "Webflow build with a CMS for integrations and articles, GSAP motion and a performance pass.",
          "deliverables": [
            {
              "title": "Analytics",
              "detail": "Demo funnel"
            }
          ]
        }
      ]
    },
    "galleryB": [
      {
        "src": "/assets/cases/halcyon.webp",
        "position": "20% 30%",
        "alt": "",
        "caption": "Hero with the live chain-of-thought demo"
      },
      {
        "src": "/assets/cases/halcyon.webp",
        "position": "80% 70%",
        "alt": "",
        "caption": "Workflow explainer and pricing"
      }
    ],
    "challenges": {
      "label": "Challenges",
      "title": "What we had to <em>solve</em>",
      "items": [
        {
          "title": "Buyers who don’t speak AI",
          "text": "Operations teams needed to see the work an agent does, not the model behind it."
        },
        {
          "title": "A feature list, not a story",
          "text": "The old site listed capabilities and lost visitors before it made its case."
        },
        {
          "title": "A category still being defined",
          "text": "There was no shared vocabulary for AI agents to lean on, so the site had to build one."
        }
      ]
    },
    "wide": {
      "src": "/assets/cases/halcyon.webp",
      "position": "50% 40%",
      "alt": "",
      "caption": "The page-by-page narrative"
    },
    "results": {
      "label": "What changed",
      "title": "Results",
      "items": [
        {
          "metric": true,
          "text": "<b>3.1×</b> demo requests in the first month"
        },
        {
          "metric": true,
          "text": "<b>48%</b> longer average visit"
        },
        {
          "metric": true,
          "text": "<b>7</b> weeks from kickoff to launch"
        },
        {
          "metric": false,
          "text": "Hours saved and tickets closed lead the page; the model names come last."
        },
        {
          "metric": false,
          "text": "A live chain-of-thought demo in the hero — no video, no screenshots."
        },
        {
          "metric": false,
          "text": "Auth, permissions and pricing written for the people who kept asking."
        }
      ]
    },
    "more": {
      "label": "More work",
      "title": "Other projects <em>worth a look</em>",
      "items": [
        {
          "slug": "northwind",
          "name": "Northwind",
          "kind": "Website",
          "image": "/assets/cases/northwind.webp"
        },
        {
          "slug": "aster",
          "name": "Aster Labs",
          "kind": "Platform site",
          "image": "/assets/cases/aster.webp"
        },
        {
          "slug": "fold",
          "name": "Fold",
          "kind": "Banking app",
          "image": "/assets/cases/fold.webp"
        }
      ]
    }
  },
  {
    "slug": "northwind",
    "meta": {
      "title": "Northwind — Visuolab",
      "description": "Northwind case study: Northwind's site turned a services list into a lead engine."
    },
    "card": {
      "name": "Northwind",
      "year": "2025",
      "type": "Website · Marketing",
      "tags": [
        "Web",
        "Brand"
      ],
      "filters": [
        "web",
        "brand"
      ],
      "image": {
        "src": "/assets/cases/northwind.webp",
        "alt": "Northwind marketing agency site — design by Ridoy Rock"
      }
    },
    "hero": {
      "breadcrumb": "Northwind",
      "title": "Northwind's site turned a services list into a <em>lead engine</em>",
      "facts": [
        {
          "term": "Client",
          "value": "Northwind"
        },
        {
          "term": "Industry",
          "value": "Marketing · Agency"
        },
        {
          "term": "Services",
          "value": "Brand refresh, Web design, Webflow development"
        },
        {
          "term": "Year",
          "value": "2025"
        },
        {
          "term": "Timeline",
          "value": "6 weeks"
        }
      ]
    },
    "cover": {
      "src": "/assets/cases/northwind.webp",
      "alt": "Northwind marketing agency site — design by Ridoy Rock"
    },
    "about": {
      "label": "About project",
      "lead": "<em>Northwind</em> is a digital marketing agency with strong results and a website that read like a brochure. Leads arrived almost entirely through referrals while the site converted next to none of its own traffic. Visuolab turned the case work into the argument and built the funnel around it.",
      "stats": [
        {
          "value": "2.6<em>×</em>",
          "label": "qualified leads per month"
        },
        {
          "value": "61<em>%</em>",
          "label": "drop in form abandonment"
        },
        {
          "value": "6<em></em>",
          "label": "weeks from kickoff to launch"
        }
      ]
    },
    "galleryA": [
      {
        "src": "/assets/cases/northwind.webp",
        "position": "20% 30%",
        "alt": "",
        "caption": "Results-first home page"
      },
      {
        "src": "/assets/cases/northwind.webp",
        "position": "80% 70%",
        "alt": "",
        "caption": "The case study template"
      }
    ],
    "process": {
      "label": "How it went",
      "title": "Four phases, <em>one team</em> throughout",
      "steps": [
        {
          "title": "Discovery",
          "duration": "1 week",
          "text": "Analytics audit, sales interviews and a review of every inbound lead from the last year.",
          "deliverables": [
            {
              "title": "Brand refresh",
              "detail": "Wordmark, type, motion"
            },
            {
              "title": "Website",
              "detail": "Webflow"
            }
          ]
        },
        {
          "title": "Brand refresh",
          "duration": "1 week",
          "text": "Wordmark, type and colour tightened; a motion mark for the site.",
          "deliverables": [
            {
              "title": "Case study template",
              "detail": "CMS"
            },
            {
              "title": "Lead form",
              "detail": "HubSpot"
            }
          ]
        },
        {
          "title": "Design",
          "duration": "2 weeks",
          "text": "Results-first home, a case study template, services and a three-question lead form.",
          "deliverables": [
            {
              "title": "Article system",
              "detail": "CMS"
            }
          ]
        },
        {
          "title": "Build",
          "duration": "2 weeks",
          "text": "Webflow with a CMS for cases and articles; HubSpot wired to the form.",
          "deliverables": [
            {
              "title": "Launch support",
              "detail": "2 weeks"
            }
          ]
        }
      ]
    },
    "galleryB": [
      {
        "src": "/assets/cases/northwind.webp",
        "position": "20% 30%",
        "alt": "",
        "caption": "Results-first home page"
      },
      {
        "src": "/assets/cases/northwind.webp",
        "position": "80% 70%",
        "alt": "",
        "caption": "The case study template"
      }
    ],
    "challenges": {
      "label": "Challenges",
      "title": "What we had to <em>solve</em>",
      "items": [
        {
          "title": "A site that read like a brochure",
          "text": "Strong results, but the website described services instead of proving them."
        },
        {
          "title": "Leads only through referrals",
          "text": "The site converted almost none of its own traffic."
        },
        {
          "title": "Case work kept offstage",
          "text": "The results that won referrals weren’t doing any work on the site."
        }
      ]
    },
    "wide": {
      "src": "/assets/cases/northwind.webp",
      "position": "50% 40%",
      "alt": "",
      "caption": "Services and the three-question form"
    },
    "results": {
      "label": "What changed",
      "title": "Results",
      "items": [
        {
          "metric": true,
          "text": "<b>2.6×</b> qualified leads per month"
        },
        {
          "metric": true,
          "text": "<b>61%</b> drop in form abandonment"
        },
        {
          "metric": true,
          "text": "<b>6</b> weeks from kickoff to launch"
        },
        {
          "metric": false,
          "text": "Client numbers lead the home page; the services list comes second."
        },
        {
          "metric": false,
          "text": "A short form with the rest asked on the call — abandonment fell by 61%."
        },
        {
          "metric": false,
          "text": "A template the team can publish in an hour, numbers first."
        }
      ]
    },
    "more": {
      "label": "More work",
      "title": "Other projects <em>worth a look</em>",
      "items": [
        {
          "slug": "aster",
          "name": "Aster Labs",
          "kind": "Platform site",
          "image": "/assets/cases/aster.webp"
        },
        {
          "slug": "fold",
          "name": "Fold",
          "kind": "Banking app",
          "image": "/assets/cases/fold.webp"
        },
        {
          "slug": "orbit",
          "name": "Orbit",
          "kind": "Fintech app",
          "image": "/assets/cases/orbit.webp"
        }
      ]
    }
  },
  {
    "slug": "aster",
    "meta": {
      "title": "Aster Labs — Visuolab",
      "description": "Aster Labs case study: Aster Labs made earning and investing in crypto feel calm, not chaotic."
    },
    "card": {
      "name": "Aster Labs",
      "year": "2026",
      "type": "Platform site · Web3 · Fintech",
      "tags": [
        "Web",
        "Product",
        "Motion"
      ],
      "filters": [
        "web",
        "product",
        "motion"
      ],
      "image": {
        "src": "/assets/cases/aster.webp",
        "alt": "Aster Labs crypto platform site — design by Ridoy Rock"
      }
    },
    "hero": {
      "breadcrumb": "Aster Labs",
      "title": "Aster Labs made <em>earning and investing</em> in crypto feel calm, not chaotic",
      "facts": [
        {
          "term": "Client",
          "value": "Aster Labs"
        },
        {
          "term": "Industry",
          "value": "Web3 · Fintech"
        },
        {
          "term": "Services",
          "value": "Product design, Web design, Motion"
        },
        {
          "term": "Year",
          "value": "2026"
        },
        {
          "term": "Timeline",
          "value": "8 weeks"
        }
      ]
    },
    "cover": {
      "src": "/assets/cases/aster.webp",
      "alt": "Aster Labs crypto platform site — design by Ridoy Rock"
    },
    "about": {
      "label": "About project",
      "lead": "<em>Aster Labs</em> is a crypto platform with serious infrastructure behind a site that looked like every other token launch. New users did not trust it and experienced ones could not find the yield products. Visuolab gave the protocol a brand and an interface that reads as a financial institution, not a launchpad.",
      "stats": [
        {
          "value": "44<em>%</em>",
          "label": "more wallets connected"
        },
        {
          "value": "2.2<em>×</em>",
          "label": "time spent on product pages"
        },
        {
          "value": "8<em></em>",
          "label": "weeks from kickoff to launch"
        }
      ]
    },
    "galleryA": [
      {
        "src": "/assets/cases/aster.webp",
        "position": "20% 30%",
        "alt": "",
        "caption": "Home, redesigned for trust"
      },
      {
        "src": "/assets/cases/aster.webp",
        "position": "80% 70%",
        "alt": "",
        "caption": "Product pages and the yield explainer"
      }
    ],
    "process": {
      "label": "How it went",
      "title": "Four phases, <em>one team</em> throughout",
      "steps": [
        {
          "title": "Discovery",
          "duration": "2 weeks",
          "text": "Interviews with new and expert investors; a trust audit of the existing site.",
          "deliverables": [
            {
              "title": "Visual system",
              "detail": "Tokens, components"
            },
            {
              "title": "Platform site",
              "detail": "14 pages"
            }
          ]
        },
        {
          "title": "Design",
          "duration": "4 weeks",
          "text": "Visual system, product pages, onboarding and the yield explainer.",
          "deliverables": [
            {
              "title": "Onboarding flow",
              "detail": "Wallet connect"
            },
            {
              "title": "Yield explainer",
              "detail": "Motion"
            }
          ]
        },
        {
          "title": "Motion",
          "duration": "1 week",
          "text": "Staking and yield explained through animation rather than copy alone.",
          "deliverables": [
            {
              "title": "Design-engineering hand-off",
              "detail": "Docs"
            }
          ]
        },
        {
          "title": "Build",
          "duration": "1 week",
          "text": "Design-engineering hand-off, QA and launch.",
          "deliverables": [
            {
              "title": "QA & launch",
              "detail": "1 week"
            }
          ]
        }
      ]
    },
    "galleryB": [
      {
        "src": "/assets/cases/aster.webp",
        "position": "20% 30%",
        "alt": "",
        "caption": "Home, redesigned for trust"
      },
      {
        "src": "/assets/cases/aster.webp",
        "position": "80% 70%",
        "alt": "",
        "caption": "Product pages and the yield explainer"
      }
    ],
    "challenges": {
      "label": "Challenges",
      "title": "What we had to <em>solve</em>",
      "items": [
        {
          "title": "Looking like every token launch",
          "text": "Serious infrastructure sat behind a site that read as hype."
        },
        {
          "title": "New users didn’t trust it",
          "text": "First-time visitors left before they ever connected a wallet."
        },
        {
          "title": "Yield products nobody could find",
          "text": "Experienced users knew what they wanted but couldn’t get to it."
        }
      ]
    },
    "wide": {
      "src": "/assets/cases/aster.webp",
      "position": "50% 40%",
      "alt": "",
      "caption": "Onboarding: fees and risks before the wallet"
    },
    "results": {
      "label": "What changed",
      "title": "Results",
      "items": [
        {
          "metric": true,
          "text": "<b>44%</b> more wallets connected"
        },
        {
          "metric": true,
          "text": "<b>2.2×</b> time spent on product pages"
        },
        {
          "metric": true,
          "text": "<b>8</b> weeks from kickoff to launch"
        },
        {
          "metric": false,
          "text": "Fees and risks shown before the wallet prompt — connections went up, not down."
        },
        {
          "metric": false,
          "text": "Yield, staking and vaults explained in sentences a newcomer can follow."
        },
        {
          "metric": false,
          "text": "Animation shows where yield comes from instead of decorating the hero."
        }
      ]
    },
    "more": {
      "label": "More work",
      "title": "Other projects <em>worth a look</em>",
      "items": [
        {
          "slug": "fold",
          "name": "Fold",
          "kind": "Banking app",
          "image": "/assets/cases/fold.webp"
        },
        {
          "slug": "orbit",
          "name": "Orbit",
          "kind": "Fintech app",
          "image": "/assets/cases/orbit.webp"
        },
        {
          "slug": "marlow",
          "name": "Marlow & Co.",
          "kind": "Rebrand",
          "image": "/assets/cases/marlow.webp"
        }
      ]
    }
  },
  {
    "slug": "fold",
    "meta": {
      "title": "Fold — Visuolab",
      "description": "Fold case study: Fold's card app put every balance one thumb away."
    },
    "card": {
      "name": "Fold",
      "year": "2024",
      "type": "Banking app · Fintech",
      "tags": [
        "Product",
        "Motion"
      ],
      "filters": [
        "product",
        "motion"
      ],
      "image": {
        "src": "/assets/cases/fold.webp",
        "alt": "Fold credit card app — design by Ridoy Rock"
      }
    },
    "hero": {
      "breadcrumb": "Fold",
      "title": "Fold's card app put <em>every balance</em> one thumb away",
      "facts": [
        {
          "term": "Client",
          "value": "Fold"
        },
        {
          "term": "Industry",
          "value": "Fintech · Cards"
        },
        {
          "term": "Services",
          "value": "Product design, Design system, Motion"
        },
        {
          "term": "Year",
          "value": "2024"
        },
        {
          "term": "Timeline",
          "value": "10 weeks"
        }
      ]
    },
    "cover": {
      "src": "/assets/cases/fold.webp",
      "alt": "Fold credit card app — design by Ridoy Rock"
    },
    "about": {
      "label": "About project",
      "lead": "<em>Fold</em> issues credit cards to freelancers. The app had grown around the card rather than the person: three taps to see a limit, five to pay a bill, and a light theme nobody used at night. Visuolab reorganised the product around the questions people actually open it to answer.",
      "stats": [
        {
          "value": "37<em>%</em>",
          "label": "more bills paid on time"
        },
        {
          "value": "4.7<em></em>",
          "label": "App Store rating, up from 3.8"
        },
        {
          "value": "10<em></em>",
          "label": "weeks from kickoff to hand-off"
        }
      ]
    },
    "galleryA": [
      {
        "src": "/assets/cases/fold.webp",
        "position": "20% 30%",
        "alt": "",
        "caption": "Home: what's due and what's left"
      },
      {
        "src": "/assets/cases/fold.webp",
        "position": "80% 70%",
        "alt": "",
        "caption": "Cards and transactions, both themes"
      }
    ],
    "process": {
      "label": "How it went",
      "title": "Four phases, <em>one team</em> throughout",
      "steps": [
        {
          "title": "Discovery",
          "duration": "2 weeks",
          "text": "Interviews with freelancers, support-ticket analysis and a task-flow audit of the existing app.",
          "deliverables": [
            {
              "title": "Home, cards & payments",
              "detail": "iOS · Android"
            },
            {
              "title": "Design system",
              "detail": "36 components"
            }
          ]
        },
        {
          "title": "Design",
          "duration": "5 weeks",
          "text": "Home, cards, transactions and payments; dark and light themes side by side.",
          "deliverables": [
            {
              "title": "Dark & light themes",
              "detail": "One token set"
            },
            {
              "title": "Motion guidelines",
              "detail": "Lottie"
            }
          ]
        },
        {
          "title": "System",
          "duration": "2 weeks",
          "text": "Component library and motion rules; tokens shipped to the mobile teams.",
          "deliverables": [
            {
              "title": "Figma library",
              "detail": "Docs"
            }
          ]
        },
        {
          "title": "Hand-off",
          "duration": "1 week",
          "text": "Docs, QA and pairing with the iOS and Android engineers.",
          "deliverables": [
            {
              "title": "Hand-off & QA",
              "detail": "1 week"
            }
          ]
        }
      ]
    },
    "galleryB": [
      {
        "src": "/assets/cases/fold.webp",
        "position": "20% 30%",
        "alt": "",
        "caption": "Home: what's due and what's left"
      },
      {
        "src": "/assets/cases/fold.webp",
        "position": "80% 70%",
        "alt": "",
        "caption": "Cards and transactions, both themes"
      }
    ],
    "challenges": {
      "label": "Challenges",
      "title": "What we had to <em>solve</em>",
      "items": [
        {
          "title": "Built around the card, not the person",
          "text": "The app answered the card’s questions, not the freelancer’s."
        },
        {
          "title": "Too many taps",
          "text": "Three taps to see a limit and five to pay a bill."
        },
        {
          "title": "A light theme for night owls",
          "text": "Freelancers check their money late, and a light theme nobody used at night didn’t suit them."
        }
      ]
    },
    "wide": {
      "src": "/assets/cases/fold.webp",
      "position": "50% 40%",
      "alt": "",
      "caption": "Payments and limits"
    },
    "results": {
      "label": "What changed",
      "title": "Results",
      "items": [
        {
          "metric": true,
          "text": "<b>37%</b> more bills paid on time"
        },
        {
          "metric": true,
          "text": "<b>4.7</b> App Store rating, up from 3.8"
        },
        {
          "metric": true,
          "text": "<b>10</b> weeks from kickoff to hand-off"
        },
        {
          "metric": false,
          "text": "What's due and what's left on every home screen — nothing else competes."
        },
        {
          "metric": false,
          "text": "Both themes from one token set, so neither feels like an afterthought."
        },
        {
          "metric": false,
          "text": "Every payment and limit change animates, so nobody wonders whether it went through."
        }
      ]
    },
    "more": {
      "label": "More work",
      "title": "Other projects <em>worth a look</em>",
      "items": [
        {
          "slug": "orbit",
          "name": "Orbit",
          "kind": "Fintech app",
          "image": "/assets/cases/orbit.webp"
        },
        {
          "slug": "marlow",
          "name": "Marlow & Co.",
          "kind": "Rebrand",
          "image": "/assets/cases/marlow.webp"
        },
        {
          "slug": "kite",
          "name": "Kite",
          "kind": "Launch site",
          "image": "/assets/cases/kite.webp"
        }
      ]
    }
  }
];

/** Order of the cards on /works */
export const worksOrder: string[] = ["orbit","marlow","kite","verdant","halcyon","northwind","aster","fold"];

export const caseBySlug = (slug: string) => caseStudies.find((c) => c.slug === slug);

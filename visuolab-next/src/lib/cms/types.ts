/*
 * TypeScript types of the page CMS. Every section's content type is inferred from its schema (src/lib/cms/sections/*), so a type and its
 * validation cannot drift. This file adds the map from section type to content type, the sections of each template, and the row shapes.
 */
import type {
  AboutHeroSection, ArticleChromeSection, BlogFeaturedSection, BlogGridSection, BlogHeroSection, CaseMosaicSection, CaseShowcaseSection,
  CaseStudyChromeSection, ContactFormSection, ContactIntroSection, CtaBandSection, FaqAccordionSection, FooterExtrasSection, HomeHeroSection,
  IndustriesGridSection, LogoMarqueeSection, LogosCollectionSection, ManifestoSection, MissionVisionSection, OfficeClocksSection, OpenRolesSection,
  PrinciplesListSection, ProcessStepsSection, ReviewsCarouselSection, ReviewsCollectionSection, ServicesColumnsSection, ShowreelSection, SiteRatingSection,
  TimelineSection, WhyStatsSection, WorksGridSection, WorksHeroSection,
} from "./sections/index.ts";

export type { MediaReference } from "./primitives.ts";

/** Section type -> the content type its schema describes. */
export type SectionContentMap = {
  home_hero: HomeHeroSection;
  logo_marquee: LogoMarqueeSection;
  showreel: ShowreelSection;
  why_stats: WhyStatsSection;
  services_columns: ServicesColumnsSection;
  case_showcase: CaseShowcaseSection;
  industries_grid: IndustriesGridSection;
  process_steps: ProcessStepsSection;
  reviews_carousel: ReviewsCarouselSection;
  about_hero: AboutHeroSection;
  case_mosaic: CaseMosaicSection;
  principles_list: PrinciplesListSection;
  mission_vision: MissionVisionSection;
  timeline: TimelineSection;
  manifesto: ManifestoSection;
  office_clocks: OfficeClocksSection;
  faq_accordion: FaqAccordionSection;
  open_roles: OpenRolesSection;
  works_hero: WorksHeroSection;
  works_grid: WorksGridSection;
  blog_hero: BlogHeroSection;
  blog_featured: BlogFeaturedSection;
  blog_grid: BlogGridSection;
  contact_intro: ContactIntroSection;
  contact_form: ContactFormSection;
  cta_band: CtaBandSection;
  reviews_collection: ReviewsCollectionSection;
  logos_collection: LogosCollectionSection;
  site_rating: SiteRatingSection;
  footer_extras: FooterExtrasSection;
  case_study_chrome: CaseStudyChromeSection;
  article_chrome: ArticleChromeSection;
};

export type SectionType = keyof SectionContentMap;

/** The sections of each template: section key -> its type. The registry and the defaults must agree with this, and the compiler checks the defaults. */
export type TemplateSections = {
  home: { hero: "home_hero"; logos: "logo_marquee"; showreel: "showreel"; why: "why_stats"; services: "services_columns"; work: "case_showcase"; industries: "industries_grid"; process: "process_steps"; reviews: "reviews_carousel" };
  about: { hero: "about_hero"; mosaic: "case_mosaic"; principles: "principles_list"; mission: "mission_vision"; story: "timeline"; manifesto: "manifesto"; places: "office_clocks"; faq: "faq_accordion"; careers: "open_roles" };
  works: { hero: "works_hero"; grid: "works_grid"; reviews: "reviews_carousel" };
  blog: { hero: "blog_hero"; featured: "blog_featured"; grid: "blog_grid" };
  contact: { intro: "contact_intro"; form: "contact_form" };
  service_detail: { logos: "logo_marquee"; reviews: "reviews_carousel" };
  case_study_detail: { chrome: "case_study_chrome" };
  article_detail: { chrome: "article_chrome" };
  shared: { cta: "cta_band"; reviews: "reviews_collection"; logos: "logos_collection"; rating: "site_rating"; footer: "footer_extras" };
};

export type PageTemplate = keyof TemplateSections;
export type PageStatus = "draft" | "published" | "archived";

/** The content of every section of a template, by section key: what a page is made of. */
export type PageContent<P extends PageTemplate> = { [K in keyof TemplateSections[P]]: SectionContentMap[TemplateSections[P][K] & SectionType] };

/** A row of `pages`, as the code sees it. */
export type PageRecord = {
  id: string;
  slug: string;
  title: string;
  status: PageStatus;
  template: PageTemplate;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageId: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
  createdAt: string;
  updatedAt: string;
};

/** A row of `page_sections` with its content already checked: the content type follows from the section type. */
export type SectionRecord = { [T in SectionType]: {
  id: string;
  pageId: string;
  key: string;
  type: T;
  position: number;
  isEnabled: boolean;
  content: SectionContentMap[T];
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
} }[SectionType];

/** What a section points at: a media file or a case study, at a place in its content. */
export type SectionRef = { path: string; kind: "media" | "case_study"; id: string; /** For media: what the file must be. */ mediaKind?: "image" | "video"; mime?: string };

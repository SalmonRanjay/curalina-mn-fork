# Source audit and decisions

## Supplied evidence

Curalina_MVP_Proposal.pdf and Curalina_Integrated_AI_MVP_Project_Proposal_Redesigned.docx establish the three workstreams, living-room pilot, colour-only scope, 14 weeks, four part-time contributors and human review. The PDF identifies Brain Train as the prepared-by team; the DOCX retains the generic four-person team wording. This difference does not change service scope.

Celadon CSV Programmer Handoff.xlsx is an Excel workbook, not a raw CSV. ARTWORK has 24 columns and 62 populated product records despite 125 worksheet rows. Product Image returns #VALUE! for all 62 records in data-only extraction; ordinary drawing images were not exposed by the spreadsheet reader. This does not prove no image bytes exist anywhere in the Excel package. The team must investigate Excel rich images or obtain supplier image exports before designing an image downloader around these cells.

Blank fields: Delivery Options, Delivery Location, Return Policy, SEO Key Words. No explicit currency, stock availability or furniture categories. Prices and lead times do not establish shippability. Preserve source prices as provided; decimal normalization addresses arithmetic precision, not commercial correctness.

## User decisions that override earlier integration assumptions

Standalone Python microservices; no existing-app knowledge required. Prove solutions in notebooks before service implementation. Local-first setup; cloud deployment and Docker orchestration deferred. Clean architecture and unit tests mandatory when extracting service code. This pack provides guides and experimental notebooks, not implemented microservices.

The current repository still contains a TypeScript React/Express application with Drizzle/PostgreSQL schema, product catalogue records, render records, uploads, cart/order flows and legacy AI generation paths. That application is the future UI/orchestration consumer for these services. It is not the authority for service-internal recommendation, variant or room-rendering business rules.

## Open decisions with defaults

| Decision | Default for architecture | Needed before |
|---|---|---|
| Currency and budget inclusions | Unknown; research-only price filtering if explicitly labelled | Shoppable acceptance |
| Furniture catalogue | Artwork pilot now; synthetic layout fixtures labelled | Real full-room recommender evaluation |
| Product images | Obtain approved exports/direct asset files | Variant/room experiments |
| GPU device and memory | CPU tooling plus separately measured CUDA candidate runs | Model feasibility gate |
| Design manual details | Reviewed subset of supplied rules; no invented thresholds | Full rule-compliance claim |
| Mask correction UI | Manual notebook annotation first | Service client refinement workflow |
| Style and relevance judgements | Named designer approves fixtures | Held-out evaluation |
| Service frameworks | FastAPI proposed; framework-neutral core | Implementation dependency lock |
| Public authentication and hosting | Deferred; local loopback only | Any public deployment |
| Existing UI adapter | Feature-flagged HTTP consumer, not shared Python imports or shared service databases | Integrated local suite with UI |

## Interpretation corrections

Recorded seeds improve repeatability but do not guarantee identical images across devices or library versions. Product IDs establish intended provenance, not proof that pixels match. No single photograph certifies physical dimensions. Open-weight model availability does not establish fitness for exact product rendering. A job success and an approved/purchasable output are separate facts.

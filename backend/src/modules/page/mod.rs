//! `page` module — Notion-parity page CRUD, tree listing, publish, move,
//! versions, search, templates, backlinks, public-site toggle, cover/image
//! upload, and `page_links` re-sync on content save.
//!
//! Mounted at `/api/pages` by `main.rs` (merged with `doc_comment::router()`
//! before nesting so that `/api/pages/:id/comments` routes resolve correctly).
//!
//! # Endpoints
//!
//! | Method | Path                                    | Handler                      |
//! |--------|-----------------------------------------|------------------------------|
//! | GET    | `/`                                     | list as tree (non-templates) |
//! | GET    | `/search`                               | search by title (trgm)       |
//! | GET    | `/templates`                            | list template pages          |
//! | POST   | `/move`                                 | reparent / reorder           |
//! | POST   | `/from-template`                        | create page from template    |
//! | POST   | `/`                                     | create page                  |
//! | GET    | `/:id`                                  | get page (V2 fields)         |
//! | PATCH  | `/:id`                                  | update page (V2: icon/cover) |
//! | DELETE | `/:id`                                  | delete page                  |
//! | POST   | `/:id/publish`                          | publish (draft→published)    |
//! | POST   | `/:id/public`                           | toggle is_public + slug      |
//! | POST   | `/:id/cover`                            | upload cover image           |
//! | GET    | `/:id/backlinks`                        | inbound @page mentions       |
//! | GET    | `/:id/links`                            | outbound @page mentions      |
//! | GET    | `/:id/versions`                         | list versions                |
//! | POST   | `/:id/versions`                         | save-version snapshot        |
//! | GET    | `/:id/versions/:version_id`             | get version                  |
//! | POST   | `/:id/versions/:version_id/restore`     | restore version              |
//! | POST   | `/:id/images`                           | upload page image            |

mod handlers;
pub mod models;
mod routes;
pub mod service;

/// Re-export the module router for mounting in `main.rs`.
pub use routes::router;

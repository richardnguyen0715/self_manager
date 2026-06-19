//! `page` module — Page CRUD, tree listing, publish, move, versions, search,
//! and image upload.
//!
//! Mounted at `/api/pages` by `main.rs` (merged with `doc_comment::router()`
//! before nesting so that `/api/pages/:id/comments` routes resolve correctly).
//!
//! # Endpoints
//!
//! | Method | Path                                    | Handler                  |
//! |--------|-----------------------------------------|--------------------------|
//! | GET    | `/`                                     | list as tree             |
//! | GET    | `/search`                               | search by title (trgm)   |
//! | POST   | `/move`                                 | reparent / reorder       |
//! | POST   | `/`                                     | create page              |
//! | GET    | `/:id`                                  | get page                 |
//! | PATCH  | `/:id`                                  | update page              |
//! | DELETE | `/:id`                                  | delete page              |
//! | POST   | `/:id/publish`                          | publish (draft→published)|
//! | GET    | `/:id/versions`                         | list versions            |
//! | POST   | `/:id/versions`                         | save-version snapshot    |
//! | GET    | `/:id/versions/:version_id`             | get version              |
//! | POST   | `/:id/versions/:version_id/restore`     | restore version          |
//! | POST   | `/:id/images`                           | upload page image        |

mod handlers;
pub mod models;
mod routes;
pub mod service;

/// Re-export the module router for mounting in `main.rs`.
pub use routes::router;

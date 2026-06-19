//! `database` module — Database CRUD, columns, rows, views, server-side
//! filter/sort/group for the Notion-parity Docs V2 feature.
//!
//! Mounted at `/api/databases` by `main.rs`.
//!
//! # Endpoints
//!
//! | Method | Path                                | Description                        |
//! |--------|-------------------------------------|------------------------------------|
//! | GET    | `/`                                 | list databases in a space          |
//! | POST   | `/`                                 | create database (seeds col + view) |
//! | GET    | `/:id`                              | get database + columns + views     |
//! | PATCH  | `/:id`                              | update title / icon                |
//! | DELETE | `/:id`                              | delete (cascades)                  |
//! | GET    | `/:id/columns`                      | list columns                       |
//! | POST   | `/:id/columns`                      | create column                      |
//! | PATCH  | `/:id/columns/:col_id`              | update column                      |
//! | DELETE | `/:id/columns/:col_id`              | delete column + strip from rows    |
//! | GET    | `/:id/rows`                         | list rows (raw)                    |
//! | POST   | `/:id/rows`                         | create row                         |
//! | PATCH  | `/:id/rows`                         | batch update rows (Board drag)     |
//! | PATCH  | `/:id/rows/:row_id`                 | update row (shallow-merge)         |
//! | DELETE | `/:id/rows/:row_id`                 | delete row                         |
//! | GET    | `/:id/views`                        | list views                         |
//! | POST   | `/:id/views`                        | create view                        |
//! | PATCH  | `/:id/views/:view_id`               | update view                        |
//! | DELETE | `/:id/views/:view_id`               | delete view                        |
//! | GET    | `/:id/views/:view_id/rows`          | rows filtered+sorted+grouped       |

mod handlers;
pub mod models;
mod routes;
pub mod service;

/// Re-export the module router for mounting in `main.rs`.
pub use routes::router;

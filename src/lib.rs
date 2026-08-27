//! Sightline SFU — serveur de conférence WebRTC.
//!
//! Trois couches, empilées du bas vers le haut :
//!
//! - [`transport`] — WebRTC et UDP (str0m). Une connexion par peer.
//! - [`media`] — routage des paquets RTP. Ne connaît que le trait
//!   [`media::RtpSink`], donc testable sans réseau.
//! - [`signaling`] — protocole WebSocket JSON et cycle de vie des sessions.
//!
//! [`room`] tient l'appartenance des peers, [`app`] l'état partagé et le
//! routeur HTTP.

pub mod app;
pub mod config;
pub mod error;
pub mod http;
pub mod media;
pub mod metrics;
pub mod room;
pub mod signaling;
pub mod transport;

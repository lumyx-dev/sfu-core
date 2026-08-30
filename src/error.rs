//! SFU error type.

use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SfuError {
    /// SDP negotiation (offer parsing, answer generation).
    Sdp(String),
    /// Invalid ICE candidate.
    Ice(String),
    /// Transport layer (socket, str0m).
    Transport(String),
}

impl fmt::Display for SfuError {
    /// Renders the bare message with no prefix: callers already compose
    /// their own context ("Erreur offer : {e}").
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SfuError::Sdp(m) | SfuError::Ice(m) | SfuError::Transport(m) => write!(f, "{}", m),
        }
    }
}

impl std::error::Error for SfuError {}

pub type Result<T> = std::result::Result<T, SfuError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_is_the_bare_message() {
        assert_eq!(SfuError::Sdp("bad sdp".into()).to_string(), "bad sdp");
        assert_eq!(SfuError::Ice("bad ice".into()).to_string(), "bad ice");
        assert_eq!(SfuError::Transport("boom".into()).to_string(), "boom");
    }
}

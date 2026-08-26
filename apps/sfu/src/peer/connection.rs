// src/peer/connection.rs

use crate::peer::track::RtpPacketData;
use crate::signaling::ServerMessage;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;
use str0m::{
    Candidate, Event, Input, Output, Rtc,
    change::SdpOffer,
    media::{MediaKind, Pt},
    net::Receive,
    rtp::{RtpWrite, SeqNo, Ssrc},
};
use tokio::net::UdpSocket;
use tokio::sync::Mutex;

pub struct PeerConnection {
    pub peer_id: String,
    pub rtc: Rtc,
    pub socket: Arc<UdpSocket>,
    pub remote_addr: Option<SocketAddr>,
    pub sender: tokio::sync::broadcast::Sender<ServerMessage>,
    pub tx_streams: HashMap<String, (MediaKind, Ssrc)>,
}

impl PeerConnection {
    pub async fn new(
        peer_id: String,
        sender: tokio::sync::broadcast::Sender<ServerMessage>,
    ) -> PeerConnection {
        let socket = UdpSocket::bind("0.0.0.0:0").await.unwrap();
        let local_port = socket.local_addr().unwrap().port();
        tracing::info!("Peer {} — UDP sur port {}", peer_id, local_port);

        let rtc = Rtc::builder().set_rtp_mode(true).build(Instant::now());

        PeerConnection {
            peer_id,
            rtc,
            socket: Arc::new(socket),
            remote_addr: None,
            sender,
            tx_streams: HashMap::new(),
        }
    }

    pub fn handle_offer(&mut self, sdp: &str) -> Result<String, String> {
        let port = self.socket.local_addr().unwrap().port();
        let local_addr: SocketAddr = format!("127.0.0.1:{}", port).parse().unwrap();

        let candidate = Candidate::host(local_addr, "udp").map_err(|e| e.to_string())?;
        self.rtc.add_local_candidate(candidate);

        let offer = SdpOffer::from_sdp_string(sdp).map_err(|e| e.to_string())?;
        let answer = self
            .rtc
            .sdp_api()
            .accept_offer(offer)
            .map_err(|e| e.to_string())?;

        let answer_sdp = answer.to_sdp_string();
        self.sender
            .send(ServerMessage::SfuAnswer {
                sdp: answer_sdp.clone(),
            })
            .ok();

        Ok(answer_sdp)
    }

    pub fn add_remote_candidate(&mut self, candidate: &str) {
        if let Ok(c) = Candidate::from_sdp_string(candidate) {
            self.rtc.add_remote_candidate(c);
        }
    }

    pub fn write_rtp(&mut self, packet: &RtpPacketData) -> Result<(), String> {
        let is_video = packet.payload_type >= 96;
        let kind = if is_video {
            MediaKind::Video
        } else {
            MediaKind::Audio
        };

        let mid = self
            .tx_streams
            .iter()
            .find(|(_, (k, _))| *k == kind)
            .map(|(mid_str, _)| str0m::media::Mid::from(mid_str.as_str()));

        let mid = match mid {
            Some(m) => m,
            None => return Ok(()),
        };

        let pt = Pt::new_with_value(packet.payload_type);
        let seq_no = str0m::rtp::SeqNo::from(packet.sequence_number as u64);

        let rtp_write = RtpWrite::new(
            pt,
            seq_no,
            packet.timestamp,
            std::time::Instant::now(),
            packet.payload.as_slice(),
        )
        .nackable(true);

        let mut api = self.rtc.direct_api();
        if let Some(stream) = api.stream_tx_by_mid(mid, None) {
            stream.write_rtp(rtp_write);
            tracing::debug!(
                "Peer {} — RTP forwardé mid={:?} pt={} seq={} {} bytes",
                self.peer_id,
                mid,
                packet.payload_type,
                packet.sequence_number,
                packet.payload.len()
            );
        } else {
            tracing::warn!(
                "Peer {} — stream_tx_by_mid non trouvé pour mid={:?}",
                self.peer_id,
                mid
            );
        }

        tracing::info!(
            "write_rtp — peer={} is_video={} tx_streams={:?}",
            self.peer_id,
            is_video,
            self.tx_streams.keys().collect::<Vec<_>>()
        );

        Ok(())
    }

    pub async fn run(
        conn: Arc<Mutex<PeerConnection>>,
        rtp_tx: tokio::sync::mpsc::UnboundedSender<(String, RtpPacketData)>,
    ) {
        let socket = {
            let c = conn.lock().await;
            c.socket.clone()
        };

        let local_port = socket.local_addr().unwrap().port();
        let local_addr: SocketAddr = format!("127.0.0.1:{}", local_port).parse().unwrap();

        {
            let mut c = conn.lock().await;
            if let Ok(candidate) = Candidate::host(local_addr, "udp") {
                c.rtc.add_local_candidate(candidate);
            }
        }

        let mut buf = vec![0u8; 2000];

        loop {
            let timeout = {
                let mut c = conn.lock().await;
                loop {
                    match c.rtc.poll_output().unwrap() {
                        Output::Timeout(t) => break t,
                        Output::Transmit(t) => {
                            let _ = socket.send_to(&t.contents, t.destination).await;
                        }
                        Output::Event(event) => {
                            Self::handle_event(&mut c, event, &rtp_tx).await;
                        }
                    }
                }
            };

            let now = Instant::now();
            let duration = if timeout > now {
                timeout - now
            } else {
                std::time::Duration::ZERO
            };

            tokio::select! {
                result = socket.recv_from(&mut buf) => {
                    match result {
                        Ok((len, addr)) => {
                            let mut c = conn.lock().await;
                            c.remote_addr = Some(addr);
                            let contents = buf[..len].to_vec();
                            if let Ok(contents) = contents.as_slice().try_into() {
                                let _ = c.rtc.handle_input(Input::Receive(
                                    Instant::now(),
                                    Receive {
                                        proto: str0m::net::Protocol::Udp,
                                        source: addr,
                                        destination: local_addr,
                                        contents,
                                    }
                                ));
                            }
                        }
                        Err(e) => {
                            tracing::error!("Peer UDP error : {}", e);
                            break;
                        }
                    }
                }
                _ = tokio::time::sleep(duration) => {
                    let mut c = conn.lock().await;
                    let _ = c.rtc.handle_input(Input::Timeout(Instant::now()));
                }
            }
        }
    }

    async fn handle_event(
        conn: &mut PeerConnection,
        event: Event,
        rtp_tx: &tokio::sync::mpsc::UnboundedSender<(String, RtpPacketData)>,
    ) {
        match event {
            Event::Connected => {
                tracing::info!("✅ Peer {} connecté (ICE + DTLS)", conn.peer_id);
            }
            Event::IceConnectionStateChange(state) => {
                tracing::info!("Peer {} ICE : {:?}", conn.peer_id, state);
            }
            Event::MediaAdded(media) => {
                tracing::info!(
                    "✅ Peer {} media ajouté : {:?} mid={:?} direction={:?}",
                    conn.peer_id,
                    media.kind,
                    media.mid,
                    media.direction
                );

                conn.tx_streams.insert(
                    media.mid.to_string(),
                    (media.kind, str0m::rtp::Ssrc::from(0u32)),
                );
            }
            Event::RtpPacket(rtp) => {
                let packet = RtpPacketData {
                    payload_type: *rtp.header.payload_type,
                    sequence_number: rtp.header.sequence_number.into(),
                    timestamp: rtp.header.timestamp,
                    ssrc: *rtp.header.ssrc,
                    payload: rtp.payload.to_vec(),
                    is_keyframe: false,
                    mid: rtp.header.ext_vals.mid.map(|m| *m as u8).unwrap_or(0),
                };
                let _ = rtp_tx.send((conn.peer_id.clone(), packet));
            }
            Event::KeyframeRequest(_req) => {
                tracing::info!("Peer {} — keyframe request", conn.peer_id);
            }
            _ => {}
        }
    }
}

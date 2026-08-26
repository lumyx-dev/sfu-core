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
    rtp::{RtpWrite, Ssrc},
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
    pub ssrc_to_mid: HashMap<u32, String>,
    pub rx_ssrcs: Vec<Ssrc>,
    pub mid_kind: HashMap<String, str0m::media::MediaKind>,
}

impl PeerConnection {
    pub async fn new(
        peer_id: String,
        sender: tokio::sync::broadcast::Sender<ServerMessage>,
    ) -> PeerConnection {
        let socket = UdpSocket::bind("0.0.0.0:0").await.unwrap();
        let local_port = socket.local_addr().unwrap().port();
        tracing::info!("Peer {} — UDP sur port {}", peer_id, local_port);

        let rtc = Rtc::builder()
            // .set_rtp_mode(true)
            .build(Instant::now());

        PeerConnection {
            peer_id,
            rtc,
            socket: Arc::new(socket),
            remote_addr: None,
            sender,
            tx_streams: HashMap::new(),
            ssrc_to_mid: HashMap::new(),
            rx_ssrcs: Vec::new(),
            mid_kind: HashMap::new(),
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
        if packet.mid.is_empty() || !self.tx_streams.contains_key(&packet.mid) {
            return Ok(());
        }

        let mid = str0m::media::Mid::from(packet.mid.as_str());

        if let Some(writer) = self.rtc.writer(mid) {
            let pt = writer.payload_params().next().map(|p| p.pt());

            if let Some(pt) = pt {
                let rtp_time = if packet.is_video {
                    str0m::media::MediaTime::from_90khz(packet.rtp_time)
                } else {
                    str0m::media::MediaTime::new(
                        packet.rtp_time,
                        str0m::media::Frequency::FORTY_EIGHT_KHZ,
                    )
                };

                let _ = writer.write(pt, packet.network_time, rtp_time, packet.payload.as_slice());

                tracing::debug!(
                    "Peer {} — write_rtp mid={:?} pt={:?} is_video={} {} bytes",
                    self.peer_id,
                    mid,
                    pt,
                    packet.is_video,
                    packet.payload.len()
                );
            } else {
                tracing::warn!(
                    "Peer {} — aucun PT disponible pour mid={:?}",
                    self.peer_id,
                    mid
                );
            }
        } else {
            tracing::warn!("Peer {} — writer non trouvé mid={:?}", self.peer_id, mid);
        }

        Ok(())
    }

    pub fn request_keyframe(&mut self) {
        let ssrcs: Vec<Ssrc> = self.rx_ssrcs.clone();
        for ssrc in ssrcs {
            let mut api = self.rtc.direct_api();
            if let Some(stream) = api.stream_rx(&ssrc) {
                stream.request_keyframe(str0m::media::KeyframeRequestKind::Pli);
                tracing::info!("Peer {} — PLI envoyée ssrc={:?}", self.peer_id, ssrc);
            }
        }
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
                    "✅ Peer {} media ajouté : {:?} mid={:?}",
                    conn.peer_id,
                    media.kind,
                    media.mid
                );
                conn.tx_streams.insert(
                    media.mid.to_string(),
                    (media.kind, str0m::rtp::Ssrc::from(0u32)),
                );
                conn.mid_kind.insert(media.mid.to_string(), media.kind);
            }
            Event::MediaData(data) => {
                let mid_str = data.mid.to_string();
                let is_video = conn
                    .mid_kind
                    .get(&mid_str)
                    .map(|k| *k == str0m::media::MediaKind::Video)
                    .unwrap_or(false);

                let freq = if is_video {
                    str0m::media::Frequency::NINETY_KHZ
                } else {
                    str0m::media::Frequency::FORTY_EIGHT_KHZ
                };

                let rtp_time = data.time.rebase(freq).numer();
                let packet = RtpPacketData {
                    payload_type: *data.pt,
                    sequence_number: 0,
                    timestamp: data.time.as_seconds() as u32,
                    ssrc: 0,
                    payload: data.data.to_vec(),
                    is_keyframe: data.contiguous,
                    mid: mid_str,
                    network_time: data.network_time,
                    rtp_time,
                    is_video,
                };
                let _ = rtp_tx.send((conn.peer_id.clone(), packet));
            }
            // Event::RtpPacket(rtp) => {
            //     let ssrc = *rtp.header.ssrc;

            //     let ssrc_typed = Ssrc::from(ssrc);
            //     if !conn.rx_ssrcs.contains(&ssrc_typed) {
            //         conn.rx_ssrcs.push(ssrc_typed);
            //     }

            //     let mid_str = if let Some(mid) = rtp.header.ext_vals.mid {
            //         let s = mid.to_string();
            //         conn.ssrc_to_mid.insert(ssrc, s.clone());
            //         s
            //     } else {
            //         conn.ssrc_to_mid.get(&ssrc).cloned().unwrap_or_default()
            //     };

            //     let packet = RtpPacketData {
            //         payload_type: *rtp.header.payload_type,
            //         sequence_number: rtp.header.sequence_number.into(),
            //         timestamp: rtp.header.timestamp,
            //         ssrc,
            //         payload: rtp.payload.to_vec(),
            //         is_keyframe: false,
            //         mid: mid_str,
            //     };
            //     let _ = rtp_tx.send((conn.peer_id.clone(), packet));
            // }
            Event::KeyframeRequest(_req) => {
                tracing::info!("Peer {} — keyframe request reçue", conn.peer_id);
            }
            _ => {}
        }
    }
}

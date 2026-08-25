use crate::peer::track::RtpPacketData;
use crate::signaling::ServerMessage;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;
use str0m::{Candidate, Event, Input, Output, Rtc, change::SdpOffer, net::Receive};
use tokio::net::UdpSocket;
use tokio::sync::Mutex;

pub struct PeerConnection {
    pub peer_id: String,
    pub rtc: Rtc,
    pub socket: Arc<UdpSocket>,
    pub remote_addr: Option<SocketAddr>,
    pub sender: tokio::sync::broadcast::Sender<ServerMessage>,
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

    /// Boucle principale — gère les events str0m + UDP
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

        // enregistre le candidat local
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
            Event::RtpPacket(rtp) => {
                let packet = RtpPacketData {
                    payload_type: *rtp.header.payload_type,
                    sequence_number: rtp.header.sequence_number.into(),
                    timestamp: rtp.header.timestamp,
                    ssrc: *rtp.header.ssrc,
                    payload: rtp.payload.to_vec(),
                    is_keyframe: false, // TODO détecter les keyframes
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

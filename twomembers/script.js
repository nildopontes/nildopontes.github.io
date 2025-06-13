const drone = new ScaleDrone('OOgX7u3om3pEfCPf');

// Cria o nome físico da sala, no scaledrone, por uma regra deles, deve ser precedido da string 'observable-'
const roomName = 'observable-nildopontes';
const configuration = {
  iceServers: [{
    urls: 'stun:stun.voipstunt.com'
  }]
};
let room;
let pc;

function onSuccess(msg) {
    console.log(msg);
};
function onError(error) {
  console.error(error);
};

// Evento disparado ao entrar no servidor de sinalização
drone.on('open', error => {
  if (error) {
    return onError(error);
  }
  room = drone.subscribe(roomName);
  room.on('open', error => {
    if (error) {
      onError(error);
    }
  });
  // Se recebermos um array com pelo menos 2 membros, significa que a sala está pronta para iniciar a chamada.
  room.on('members', members => {
    // Trabalha com os nomes e quantidade de usuario aqui
    onSuccess(members);
    // Verifica se você é o primeiro ou segundo usuário, se for o segundo, então iniciamos a oferta de conexão
    const isOfferer = members.length === 2;
    startWebRTC(isOfferer);
  });
});

// Envia uma mensagem pelo servidor de sinalização para todos os membros presentes na sala
function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}

function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);

  // 'onicecandidate' é disparado sempre que o peer local encontra um novo icecandidate. A ação comum é enviar esse icecandidate para o peer remoto
  pc.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({'candidate': event.candidate});
    }
  };

  // Se é o segundo usuário, 'negotiationneeded' é criado e passa a oferecer a conexão local ao peer remoto
  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer().then(localDescCreated).catch(onError);
    }
  }

  // Quando recebemos a notificação de fluxo de vídeo recebido, apresentamos ele dentro do elemento #remoteVideo
  pc.ontrack = event => {
    const stream = event.streams[0];
    if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
      remoteVideo.srcObject = stream;
    }
  };

  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  }).then(stream => {
    // Mostra o fluxo de vídeo aberto no elemento #localVideo
    localVideo.srcObject = stream;
    // Notifica os pares presente que este é o fluxo de vídeo
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  }, onError);

  // Fica escutando o Scaledrone para receber novas mensagens
  room.on('data', (message, client) => {
    // Encerra a função se a menagem recebida foi enviada por mim
    if (client.id === drone.clientId) {
      onSuccess(message);
      onSuccess(client);
      return;
    }

    if (message.sdp) {
      // Quando recebemos a mensagem do outro cliente para fechar os pares
      pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
        // Respondemos a mensagem com nossos dados
        if (pc.remoteDescription.type === 'offer') {
          pc.createAnswer().then(localDescCreated).catch(onError);
        }
      }, onError);
    } else if (message.candidate) {
      // Adiciona o icecandidate recebido do peer remoto à conaxão local
      pc.addIceCandidate(
        new RTCIceCandidate(message.candidate), onSuccess, onError
      );
    }
  });
}

function localDescCreated(desc){
  pc.setLocalDescription(
    desc,
    () => sendMessage({'sdp': pc.localDescription}),
    onError
  );
}

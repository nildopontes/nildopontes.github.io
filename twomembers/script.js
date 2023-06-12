const drone = new ScaleDrone('OOgX7u3om3pEfCPf');

// Cria o nome físico da sala, no scaledrone, por uma regra deles, deve ser precedido da string 'observable-'
const roomName = 'observable-nildopontes';
const configuration = {
  iceServers: [{
    // Coloque aqui o endereço do servidor STUN que desejar utilizar
    urls: 'stun:stun.voipstunt.com'
  }]
};
let room;
let pc;

//este par de funções serve somente par direcionar as mensagens para a CONSOLE do navegador, ou caso seja importante poderia-mos direcionar para um email, um banco de dados, entre outros.
function onSuccess(msg) {
    console.log(msg); // aqui na verdade, é uma simples LOG de que foi bem sucedida uma chamada
};
function onError(error) {
  console.error(error); // aqui é simplesmente uma mensagem que informa o erro caso algum tenha ocorrido
};

//abre a comunicação com o servidor de signaling para verificar quem está na sala
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
  // Se recebermos um array com pelo menos 2 membros, significa que a sala está pronta e os servidores de sinalização ativos.
  room.on('members', members => {
    // Trabalha com os nomes e quantidade de usuario aqui
    onSuccess(members);
    // Verifica se você é o primeiro ou segundo usuário, se for o segundo, então abrimos a oferta de troca de conexões para habilitar os fluxos de vídeo e audio WebRTC
    const isOfferer = members.length === 2;
    startWebRTC(isOfferer);
  });
});

// Esta mensagem, é a sinalização feita dentro do scaledrone que notifica um e o outro clientes com os dados para o WebRTC
function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}

function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);

  // 'onicecandidate' notifica um ou outro participante para permitir a troca de comunicação pelo WebRTC
  pc.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({'candidate': event.candidate});
    }
  };

  // Se é o segundo usuário, 'negotiationneeded' é criado e passa a oferecer o fluxo de dados entre os usuários
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

  // Fica escutando o Scaledrone para receber os fluxos de troca de dados
  room.on('data', (message, client) => {
    // verifica se mandamnos os dados da nossa conexão
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
      // Adiciona um novo ICE para esperar nova conexão
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

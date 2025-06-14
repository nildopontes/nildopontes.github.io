'use strict';

const drone = new ScaleDrone('OOgX7u3om3pEfCPf');

const configuration = {
   iceServers: [{
      urls: 'stun:stun.l.google.com:19302'
   }]
};
const offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 0,
  voiceActivityDetection: false
};
var showLog = false;
var remoteAudio;
var room;
var pc = [new RTCPeerConnection(configuration), new RTCPeerConnection(configuration), new RTCPeerConnection(configuration)];
document.addEventListener('DOMContentLoaded', function() {
   remoteAudio = [remoteAudio1, remoteAudio2, remoteAudio3];
   if(location.search == '?log'){
      showLog = true;
      log.style.display = 'initial';
   }
   onLog('Documento carregado');
});
var clients = [{id: ''}, {id: ''}, {id: ''}];

function initStream(){
   navigator.mediaDevices.getUserMedia({audio: true, video: false}).then(stream => {
      pc.forEach((element, index) => {
         onLog('Fluxo local adicionado ao pc[' + index + ']');
         element.addTrack(stream.getTracks()[0], stream);
      });
   });
}

pc.forEach((element, index) => {
   element.onicecandidate = event => {
      if(event.candidate){
         onLog('Candidate enviado pelo pc[' + index + ']');
         sendMessage({'candidate': event.candidate}, clients[index].id);
      }
   };
   element.ontrack = event => {
      const stream = event.streams[0];
      onLog('Audio remoto recebido foi anexado à conexão em pc[' + index + ']');
      remoteAudio[index].srcObject = stream;
   };
});
function setAudioLayout(){
   var qtdClients = 0;
   clients.forEach((client, index) => {
      if(client.id == ''){
         remoteAudio[index].style.visibility = 'hidden';
      }else{
         qtdClients++;
         remoteAudio[index].style.visibility = 'initial';
      }
   });
   onLog(qtdClients + ' clientes online');
}
function onLog(msg){
   if(!showLog) return;
   log.value += msg + '\n';
}

drone.on('open', error => {
   if(error){
      onLog(error);
      return;
   }
   room = drone.subscribe(roomName);
   room.on('open', error => {
      if(error){
         onLog(error);
      }
   });
   room.on('members', members => {
      onLog('Entrei na sala com id = ' + drone.clientId + '. Usuarios online: ' + (members.length-1));
      if(members.length > 1){
         setAudioLayout();
         members.forEach(member => {
            if(member.id != drone.clientId){
               for(var i = 0; i < 3; i++){
                  if(clients[i].id === ''){
                     clients[i].id = member.id;
                     onLog('Cliente com id = ' + member.id + ' presente na sala, foi adicionado à lista local');
                     break;
                  }
               }
            }
         });
      }
      setAudioLayout();
      startWebRTC(members.length);
   });
   room.on('member_join', member => {
      onLog('Um membro novo tentou entrar com id = ' + member.id);
      for(var i = 0; i < 3; i++){
         if(clients[i].id === ''){
            clients[i].id = member.id;
            onLog('Havia espaço. Ele conseguiu ficar.');
            break;
         }
      }
      setAudioLayout();
   });
   room.on('member_leave', member => {
      onLog('Saiu um membro com id = ' + id);
      const index = clients.findIndex(client => client.id === member.id);
      clients[index].id = '';
      setAudioLayout();
   });
});

function sendMessage(message, destinyId){
   if(destinyId == '') return;
   message.destiny = destinyId;
   onLog('Enviando para ' + message.destiny);
   drone.publish({
      room: roomName,
      message
   });
}
function startWebRTC(qtdMembers){
   onLog('startWebRTC(' + qtdMembers + ')');
   if(qtdMembers > 1){
      pc.forEach((element, index) => {
         element.createOffer(offerOptions)
                .then(offer => element.setLocalDescription(offer))
                .then(() => {
                   sendMessage({'sdp': element.localDescription}, clients[index].id);
                   onLog('SDP enviado pelo pc[' + index + ']');
                }).catch(err => onLog(err));
      });
   }
   room.on('data', (message, client) => {
      if(message.destiny != drone.clientId) return;
      const index = clients.findIndex(member => member.id === client.id);
      if(message.sdp){
         onLog('SDP recebido de ' + client.id);
         pc[index].setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
            if(pc[index].remoteDescription.type === 'offer'){
               pc[index].createAnswer().then((offer) => pc[index].setLocalDescription(offer)).then(() => {
                  sendMessage({'sdp': pc[index].localDescription}, clients[index].id); onLog('SDP enviado por pc[' + index + ']');}).catch((err) => {
                  onLog(err);
               });
            }
         }, onLog);
      }else if(message.candidate){
         onLog('Candidate recebido de ' + client.id);
         pc[index].addIceCandidate(message.candidate).catch(err => onLog(err));
      }
   });
}
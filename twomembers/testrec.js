'use strict';

const drone = new ScaleDrone('OOgX7u3om3pEfCPf');
const roomName = 'observable-nildopontes';
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
var remoteAudio;
var room;
var pc = [new RTCPeerConnection(configuration), new RTCPeerConnection(configuration), new RTCPeerConnection(configuration)];
document.addEventListener('DOMContentLoaded', function() {
   remoteAudio = [remoteAudio1, remoteAudio2, remoteAudio3];
});
var clients = [{id: ''}, {id: ''}, {id: ''}];

function initStream(){
   navigator.mediaDevices.getUserMedia({audio: true, video: false}).then(stream => {
      pc.forEach((element, index) => {
         element.addTrack(stream.getTracks()[0], stream);
      });
   });
}

pc.forEach((element, index) => {
   element.onicecandidate = event => {
      if(event.candidate){
         sendMessage({'candidate': event.candidate}, clients[index].id);
      }
   };
   element.ontrack = event => {
      const stream = event.streams[0];
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
}

drone.on('open', error => {
   if(error){
      console.log(error);
      return;
   }
   room = drone.subscribe(roomName);
   room.on('open', error => {
      if(error){
         console.log(error);
      }
   });
   room.on('members', members => {
      if(members.length > 1){
         setAudioLayout();
         members.forEach(member => {
            if(member.id != drone.clientId){
               for(var i = 0; i < 3; i++){
                  if(clients[i].id === ''){
                     clients[i].id = member.id;
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
      for(var i = 0; i < 3; i++){
         if(clients[i].id === ''){
            clients[i].id = member.id;
            break;
         }
      }
      setAudioLayout();
   });
   room.on('member_leave', member => {
      const index = clients.findIndex(client => client.id === member.id);
      clients[index].id = '';
      setAudioLayout();
   });
});

function sendMessage(message, destinyId){
   if(destinyId == '') return;
   message.destiny = destinyId;
   drone.publish({
      room: roomName,
      message
   });
}
function startWebRTC(qtdMembers){
   if(qtdMembers > 1){
      pc.forEach((element, index) => {
         element.createOffer(offerOptions)
                .then(offer => element.setLocalDescription(offer))
                .then(() => {
                   sendMessage({'sdp': element.localDescription}, clients[index].id);
                }).catch(err => console.log(err));
      });
   }
   room.on('data', (message, client) => {
      if(message.destiny != drone.clientId) return;
      const index = clients.findIndex(member => member.id === client.id);
      if(message.sdp){
         pc[index].setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
            if(pc[index].remoteDescription.type === 'offer'){
               pc[index].createAnswer().then((offer) => pc[index].setLocalDescription(offer)).then(() => {
                  sendMessage({'sdp': pc[index].localDescription}, clients[index].id);}).catch((err) => {
                  console.log(err);
               });
            }
         });
      }else if(message.candidate){
         pc[index].addIceCandidate(message.candidate).catch(err => console.log(err));
      }
   });
}
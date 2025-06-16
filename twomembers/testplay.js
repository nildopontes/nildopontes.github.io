'use strict';

const drone = new ScaleDrone('OOgX7u3om3pEfCPf');
const roomName = 'observable-nildopontes';
const configuration = {
   iceServers: [{
      urls: 'stun:stun.l.google.com:19302'
   }]
};
var room;
var pc = {};
var stream;
window.addEventListener('DOMContentLoaded', event => {
   const music = document.getElementById('music');
   music.addEventListener('play', event => {
      stream = music.captureStream();
   });
});
function initStream(){
   Object.keys(pc).forEach(key => {
      console.log('Stream enviado para ' + key);
      pc[key].addTrack(stream.getTracks()[0]);
      pc[key].createOffer().then(offer => {
         pc[key].setLocalDescription(offer).then(() => {
            console.log('Oferta para ' + key);
            sendMessage({'sdp': pc[key].localDescription}, key);
         });
      }).catch(err => console.log(err));
   });
}
function addMember(member){
   console.log(member + ' adicionado');
   let pcn = new RTCPeerConnection(configuration);
   pcn.onicecandidate = event => {
      if(event.candidate){
         console.log('icecandidate para ' + member);
         sendMessage({'candidate': event.candidate}, member);
      }
   };
   pcn.ontrack = event => {
      console.log('Stream de ' + member);
      console.log(event);
      //const stream = event.streams[0];
      const stream = new MediaStream(event.track);
      let audio = document.createElement('audio');
      audio.setAttribute('id', member);
      audio.setAttribute('controls', '');
      audio.setAttribute('autoplay', '');
      audio.srcObject = stream;
      document.body.appendChild(audio);
   };
   pc[member] = pcn;
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
         members.forEach(member => {
            if(member.id != drone.clientId){
               console.log(member.id + ' membro na sala');
               addMember(member.id);
            }
         });
      }
      startWebRTC();
   });
   room.on('member_join', member => {
      console.log('membro novo');
      addMember(member.id);
   });
   room.on('member_leave', member => {
      let element = document.getElementById(member.id);
      if(element) element.remove();
      delete pc[member.id];
      console.log('membro saiu');
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
function startWebRTC(){
   console.log('WebRTC iniciado');
   room.on('data', (message, member) => {
      if(message.destiny != drone.clientId) return;
      if(message.sdp){
         console.log('SDP recebido de ' + member.id);
         pc[member.id].setRemoteDescription(message.sdp, () => {
            if(pc[member.id].remoteDescription.type === 'offer'){
               console.log('SDP type is offer');
               pc[member.id].createAnswer().then(offer => pc[member.id].setLocalDescription(offer)).then(() => sendMessage({'sdp': pc[member.id].localDescription}, member.id)).catch(err => console.log(err));
            }
         });
      }else if(message.candidate){
         console.log('Candidate recebido de ' + member.id);
         pc[member.id].addIceCandidate(message.candidate).catch(err => console.log(err));
      }
   });
}
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
var room;
var pc = {};

function initStream(){
   navigator.mediaDevices.getUserMedia({audio: true, video: false}).then(stream => {
      Object.entries(pc).forEach(([chave, pcn]) => {
         pcn.addTrack(stream.getTracks()[0], stream);
      });
   });
}
function addMember(member){
   let pcn = new RTCPeerConnection(configuration);
   pcn.onicecandidate = event => {
      if(event.candidate){
         sendMessage({'candidate': event.candidate}, member);
      }
   };
   pcn.ontrack = event => {
      console.log('Stream');
      const stream = event.streams[0];
      let audio = new Audio();
      audio.setAttribute('id', member);
      audio.srcObject = stream;
      document.body.appendChild(audio);
   };
   pcn.createOffer(offerOptions).then(offer => {
      pcn.setLocalDescription(offer).then(() => {
         sendMessage({'sdp': pcn.localDescription}, member);
      });
   }).catch(err => console.log(err));
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
               addMember(member.id);
            }
         });
      }
      startWebRTC(members.length);
   });
   room.on('member_join', member => {
      addMember(member.id);
   });
   room.on('member_leave', member => {
      document.getElementById(member.id).remove();
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
   room.on('data', (message, member) => {
      if(message.destiny != drone.clientId) return;
      if(message.sdp){
         pc[member.id].setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
            if(pc[member.id].remoteDescription.type === 'offer'){
               pc[member.id].createAnswer().then(offer => pc[member.id].setLocalDescription(offer)).then(() => sendMessage({'sdp': pc[member.id].localDescription}, member.id)).catch(err => console.log(err));
            }
         });
      }else if(message.candidate){
         pc[member.id].addIceCandidate(message.candidate).catch(err => console.log(err));
      }
   });
}
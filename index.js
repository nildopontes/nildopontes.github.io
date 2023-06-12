window.addEventListener('resize', () => {
   document.body.style.minHeight = `${window.innerHeight}px`;
});
window.addEventListener('load', () => {
   document.body.style.minHeight = `${window.innerHeight}px`;
   document.getElementById('year').innerText = new Date().getFullYear();
   document.getElementsByClassName('foot')[0].style.display = 'block';
   if(location.host == 'localhost:10000') eruda.init();
});
function detail(detail, src){
   if(confirm(detail)) window.location.href = src;
}
